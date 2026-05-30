// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Proofs — PRF test token for proof.bet
/// @notice ERC20 test token used for all bets on the platform.
///         Anyone can call faucet() to receive 1000 PRF.
///         The owner can mint arbitrary amounts (for seeding the bankroll at deploy).
contract Proofs is ERC20, Ownable {
    /// @notice Amount minted per faucet call: 1000 PRF (18 decimals).
    uint256 public constant FAUCET_AMOUNT = 1000e18;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a player calls faucet().
    event FaucetMint(address indexed recipient, uint256 amount);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param initialOwner Address that receives owner privileges (use deployer).
    constructor(address initialOwner) ERC20("Proofs", "PRF") Ownable(initialOwner) { }

    // -------------------------------------------------------------------------
    // Public
    // -------------------------------------------------------------------------

    /// @notice Mint FAUCET_AMOUNT (1000 PRF) to the caller.
    ///         No limit — this is a testnet token.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetMint(msg.sender, FAUCET_AMOUNT);
    }

    // -------------------------------------------------------------------------
    // Owner
    // -------------------------------------------------------------------------

    /// @notice Owner-only mint — used to seed the ProofBet bankroll at deploy.
    /// @param to     Recipient address.
    /// @param amount Token amount (in wei, 18 decimals).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
