# Backend MotoPRO

API independente em Node.js + Express + MongoDB.

1. Instale Node.js 22+.
2. Execute `npm install` nesta pasta.
3. Copie `.env.example` para `.env` e preencha `MONGODB_URI`, `JWT_SECRET` e `APP_ORIGIN`.
4. Rode `npm run dev`; teste `http://localhost:4000/api/health`.
5. Para produção, rode `npm run build` e depois `npm start`.

**Segurança:** não envie o `.env` ao Git. Altere as credenciais antigas que apareceram em capturas de tela.
