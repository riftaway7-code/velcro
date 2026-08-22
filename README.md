# velcro

A games hub and web proxy, self-hosted with Node/Express.

## Features

- Games catalog with search and category filters
- Apps catalog for other useful sites
- A full address-bar browser page for tunneling arbitrary URLs
- Two proxy engines to choose from: [scramjet](https://github.com/MercuryWorkshop/scramjet) and [Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet), switchable in settings
- Optional custom wisp server
- Tab cloaking (custom title/favicon) and an "open in about:blank" launch mode
- Fully custom theming (pick your own background/accent colors) and wallpapers
- Light/dark aware, no premade theme lock-in

## No tracking

velcro ships with zero analytics, telemetry, or logging of any kind. Nothing about your
usage is sent anywhere except what's required to load the page and proxy your traffic.

## Credits

- [Mercury Workshop](https://github.com/MercuryWorkshop) — scramjet, bare-mux, epoxy-transport, wisp-js
- [TitaniumNetwork](https://github.com/titaniumnetwork-dev) — Ultraviolet
- Google Fonts — Sour Gummy, Nunito, Material Symbols
- Built alongside [rift](https://github.com/raahimsyed/rift) and photon, the author's earlier projects

## Running locally

```sh
npm install
npm run dev
```

Opens on `http://localhost:4173`.

## License

MIT — see [LICENSE](./LICENSE).
