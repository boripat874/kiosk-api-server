module.exports = {
  apps : [{
    name: "Kiosk-Server",
    script: 'server.js',
    watch: true,
    env: {
      NameDatabase: "pg",
      Host: "127.0.0.1",
      Users: "pgadmin",
      Password: "0000",
      Database: "kiosk",
      Port: 3030
    },
    
  }],
};
