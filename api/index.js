const app = require('../app');

const PORT = process.env.PORT || 3000;

// Només arrencar el listener si s'executa en local
if (require.main === module || (process.env.NODE_ENV !== 'production' && !process.env.VERCEL)) {
  app.listen(PORT, () => {
    console.log(`Servidor OposTest en marxa a http://localhost:${PORT}`);
  });
}

module.exports = app;
