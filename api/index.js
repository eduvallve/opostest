const app = require('../app');

// Només arrencar el listener si s'executa en local (mai a Vercel)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor OposTest en marxa a http://localhost:${PORT}`);
  });
}

// Exportar handler per a Vercel Serverless Function
module.exports = (req, res) => {
  return app(req, res);
};

