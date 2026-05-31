# Connect Wallet MetaMask

_Started 2026-05-30 17:59 UTC_

---

## User

на странице connect wallet meta mask будет основной коннект, остальные кошельки сделаем как soon также обнови иконки

## User

зачем нужен Connected to Sepolia testnet. ? прежде чем приконектить метамаск ?

## User

зачем нужен Connected to Sepolia testnet. ? прежде чем приконектить метамаск ?

## Assistant

_[tool: read_file]_

Хорошее замечание — это нелогично. До коннекта кошелька приложение в принципе не может знать сеть, поэтому ни «Wrong network», ни «Connected to Sepolia» там быть не должно. Заменю это на нейтральную информационную подсказку о том, на какой сети работает dApp (проверка сети уже произойдёт в самом MetaMask при коннекте).

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now remove the unused `wrongNet` state and add the `info` banner style.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: multi_screenshot]_

Готово. Теперь до коннекта показывается нейтральная подсказка <cite index="">«This dApp runs on the Sepolia testnet. MetaMask will ask to switch if needed»</cite> вместо ложного статуса «Connected». MetaMask остаётся основной кнопкой, остальные кошельки — Soon. Заодно фокс-иконка MetaMask теперь читается чисто.

_[tool: done]_

Поправил логику: убрал противоречивый баннер «Wrong network / Connected to Sepolia», который появлялся ещё до подключения. Вместо него — нейтральная подсказка, что dApp работает в сети Sepolia и MetaMask сам предложит переключиться при коннекте.

## User

главный файл переименнуй в proof.bet

## Assistant

_[tool: copy_files]_

_[tool: done]_

Готово — главный файл теперь называется **proof.bet.html** (все ссылки на `src/` и `styles/` относительные, так что всё работает без изменений).

