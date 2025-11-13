# Connection Mapper

An interactive web application to visualize user sign-in locations from CSV logs on an interactive map.

This tool parses security logs, geolocates all IP addresses, and plots them, providing a visual overview of connection origins.

## Features

- Displays user connections on a Leaflet.js map.
- Supports both Azure Sign-in and Audit log CSV formats.
- Automatically fetches latitude and longitude for all unique IPs.
- Supports dynamic connection filtering using collapsible UI elements:
  - User Panel: Toggle individual users or select/deselect all.
  - Filter Panel: Filter by application, OS, browser, compliance status, and more.
  - Timeline Panel: Select a specific time range using a dual-handle slider.
- Generate a compressed URL to share the current map data and view with others.
- Switch between light and dark modes.

## Installation

Clone the repository:

```sh
git clone https://github.com/Eudaeon/connection-mapper.git
cd connection-mapper
```

Install dependencies:

```sh
npm install
```

## Scripts

Format all files using Prettier:

```sh
npm run format
```

Start a local Vite development server:

```sh
npm run dev
```

Type-check and build the application:

```sh
npm run build
```
