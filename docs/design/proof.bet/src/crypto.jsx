// ============================================================
// HOUSEPROOF — provably-fair core
// Real keccak-256 (Ethereum variant) so the Verify drawer's
// "Recompute in your browser" genuinely re-derives the outcome
// from on-chain data. Both the "contract" result and the browser
// recompute call the SAME function — that's the whole point.
// ============================================================

(function () {
  // ---- keccak-f[1600] over BigInt lanes (compact, correct) ----
  const RC = [
    0x0000000000000001n,0x0000000000008082n,0x800000000000808an,0x8000000080008000n,
    0x000000000000808bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,
    0x000000000000008an,0x0000000000000088n,0x0000000080008009n,0x000000008000000an,
    0x000000008000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,
    0x8000000000008002n,0x8000000000000080n,0x000000000000800an,0x800000008000000an,
    0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n,
  ];
  const R = [0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
  const MASK = (1n << 64n) - 1n;
  const rotl = (x, n) => n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK;

  function keccakF(s) {
    for (let round = 0; round < 24; round++) {
      const C = new Array(5), D = new Array(5);
      for (let x = 0; x < 5; x++) C[x] = s[x] ^ s[x+5] ^ s[x+10] ^ s[x+15] ^ s[x+20];
      for (let x = 0; x < 5; x++) D[x] = C[(x+4)%5] ^ rotl(C[(x+1)%5], 1);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) s[x + 5*y] ^= D[x];
      const B = new Array(25);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++)
        B[y + 5*((2*x+3*y)%5)] = rotl(s[x + 5*y], R[x + 5*y]);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++)
        s[x + 5*y] = B[x + 5*y] ^ ((~B[((x+1)%5) + 5*y]) & B[((x+2)%5) + 5*y]) & MASK;
      s[0] ^= RC[round];
    }
  }

  // bytes (Uint8Array) -> 32-byte keccak256 hex string with 0x
  function keccak256(bytes) {
    const rate = 136; // keccak256 rate in bytes
    const s = new Array(25).fill(0n);
    const padded = (() => {
      const len = bytes.length;
      const blocks = Math.floor(len / rate) + 1;
      const out = new Uint8Array(blocks * rate);
      out.set(bytes);
      out[len] ^= 0x01;        // keccak domain padding
      out[out.length - 1] ^= 0x80;
      return out;
    })();
    for (let off = 0; off < padded.length; off += rate) {
      for (let i = 0; i < rate / 8; i++) {
        let lane = 0n;
        for (let b = 0; b < 8; b++) lane |= BigInt(padded[off + i*8 + b]) << BigInt(8*b);
        s[i] ^= lane;
      }
      keccakF(s);
    }
    let hex = '0x';
    for (let i = 0; i < 4; i++) { // first 32 bytes = 4 lanes, little-endian
      const lane = s[i];
      for (let b = 0; b < 8; b++)
        hex += Number((lane >> BigInt(8*b)) & 0xffn).toString(16).padStart(2, '0');
    }
    return hex;
  }

  // ---- helpers ----
  function hexToBytes(hex) {
    hex = hex.replace(/^0x/, '');
    if (hex.length % 2) hex = '0' + hex;
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i*2, 2), 16);
    return out;
  }
  function randHex(nBytes) {
    const a = new Uint8Array(nBytes);
    crypto.getRandomValues(a);
    return '0x' + Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // left-pad a hex value to 32 bytes (abi.encodePacked of a uint256 / bytes32)
  function pad32(hex) {
    hex = hex.replace(/^0x/, '');
    return hex.padStart(64, '0');
  }
  function concatBytes(...hexes) {
    const joined = hexes.map(h => pad32(h)).join('');
    return hexToBytes('0x' + joined);
  }

  // finalSeed = keccak256(vrfWord, clientSeed, nonce)
  function deriveFinalSeed(vrfWord, clientSeed, nonce) {
    const nonceHex = BigInt(nonce).toString(16);
    return keccak256(concatBytes(vrfWord, clientSeed, nonceHex));
  }

  // limbo crash point from finalSeed (bustabit-style, 2% house edge)
  // returns a number >= 1.00, two decimals
  function crashFromSeed(finalSeed) {
    const E = 2 ** 52;
    const h = Number(BigInt('0x' + finalSeed.replace(/^0x/, '').slice(0, 13))); // 52 bits
    // house edge: ~2% instant-bust band
    if (h % 50 === 0) return 1.00;
    const raw = Math.floor((100 * E - h) / (E - h)) / 100;
    return Math.max(1.00, Math.min(raw, 1000000));
  }

  // full round computation
  function computeRound(vrfWord, clientSeed, nonce) {
    const finalSeed = deriveFinalSeed(vrfWord, clientSeed, nonce);
    const crash = crashFromSeed(finalSeed);
    return { finalSeed, crash };
  }

  // ---- PLINKO ----------------------------------------------------------
  // Same finalSeed; the ball's L/R bounces are bits read straight off the
  // hash, so the whole path is recomputable. Slot = count of rights.
  function binomC(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
  }

  // multiplier curve per risk; normalized so EV = 1 - 2% edge exactly,
  // then rounded for display. Edges high, center low. Scales to any rows.
  const PLINKO_CFG = {
    low:    { lo: 0.5, hiK: 1.35, gamma: 1.9 },
    medium: { lo: 0.3, hiK: 4.2,  gamma: 2.7 },
    high:   { lo: 0.2, hiK: 14,   gamma: 3.3 },
  };
  function plinkoMultipliers(rows, risk) {
    const cfg = PLINKO_CFG[risk] || PLINKO_CFG.medium;
    const half = rows / 2;
    const hi = cfg.lo + cfg.hiK * rows;
    const raw = [];
    for (let s = 0; s <= rows; s++) {
      const d = half ? Math.abs(s - half) / half : 0;
      raw.push(cfg.lo + (hi - cfg.lo) * Math.pow(d, cfg.gamma));
    }
    const tot = Math.pow(2, rows);
    let ev = 0;
    for (let s = 0; s <= rows; s++) ev += (binomC(rows, s) / tot) * raw[s];
    const k = 0.98 / ev;
    return raw.map((m) => {
      const v = m * k;
      return v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
    });
  }

  // honest house edge of the (rounded) table actually in play
  function plinkoEdge(rows, risk) {
    const mults = plinkoMultipliers(rows, risk);
    const tot = Math.pow(2, rows);
    let ev = 0;
    for (let s = 0; s <= rows; s++) ev += (binomC(rows, s) / tot) * mults[s];
    return 1 - ev;
  }

  function plinkoFromSeed(finalSeed, rows, risk) {
    const big = BigInt('0x' + finalSeed.replace(/^0x/, '').slice(0, 48)); // 192 bits
    const path = [];
    let rights = 0;
    for (let k = 0; k < rows; k++) {
      const bit = Number((big >> BigInt(k)) & 1n); // 1 = right, 0 = left
      path.push(bit);
      rights += bit;
    }
    const multiplier = plinkoMultipliers(rows, risk)[rights];
    return { path, slot: rights, multiplier };
  }

  Object.assign(window, {
    keccak256, hexToBytes, randHex, deriveFinalSeed, crashFromSeed, computeRound,
    binomC, plinkoMultipliers, plinkoEdge, plinkoFromSeed,
  });
})();
