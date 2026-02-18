module.exports = {
  apps : [{
    name: "Kiosk-Server",
    script: 'server.js',
    watch: true,
    env: {
      NameDatabase: "pg",
      Host: "10.10.17.4",
      Users: "postgres",
      Password: "zoo@kiosk2026_pgsql",
      Database: "kiosk",
      Port: 443
    },
  }],
};
