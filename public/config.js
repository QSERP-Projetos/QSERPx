// Configuração em runtime para deploy web.
// 
// IMPORTANTE:
// - Se deixar baseUrl VAZIO (""), a aplicação irá solicitar configuração na primeira vez
// - Após configurar pela interface, a URL é salva automaticamente no localStorage
// - Para definir uma URL padrão em produção, descomente e configure abaixo:
//
// Exemplo para produção:
// globalThis.__QSERPX_CONFIG__ = {
//   baseUrl: "http://servidor.qserp.com.br:89",
// };

globalThis.__QSERPX_CONFIG__ = {
  baseUrl: "",
};
