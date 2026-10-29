// Importa o framework Express para criar e gerenciar as rotas da aplicação web
import express from "express"; 

// Importa o middleware CORS para permitir requisições de diferentes origens (front-end)
import cors from "cors"; 

// Importa a função customizada que estabelece a conexão com o banco de dados MariaDB/MySQL
import abrirConexao from "./db.js"; 

// Carrega as variáveis de ambiente declaradas no arquivo .env para o ambiente de execução
import "dotenv/config"; 

// Inicializa uma instância da aplicação Express
const app = express(); 

// Habilita o suporte a requisições com corpo no formato JSON (interpreta o body como JSON)
app.use(express.json()); 

// Disponibiliza os arquivos estáticos da raiz do projeto para acesso público
app.use(express.static("./")); 

// Habilita o CORS na aplicação para evitar bloqueios de segurança do navegador
app.use(cors()); 

// Habilita a interpretação de dados enviados por formulários no formato URL-encoded
app.use(express.urlencoded({ extended: true })); 

// Função auxiliar responsável por formatar datas recebidas no padrão DD/MM/AAAA para AAAA-MM-DD (padrão aceito pelo MariaDB)
function formatarDataParaBD(dataStr) {
  // Se a data fornecida for nula ou vazia, retorna null
  if (!dataStr) return null; 

  // Se a data já contiver hífen ("-"), assume que já está no formato ISO (AAAA-MM-DD) e a retorna
  if (dataStr.includes("-")) return dataStr; 

  // Desestrutura a string dividindo-a pelas barras "/" em dia, mês e ano
  const [dia, mes, ano] = dataStr.split("/"); 

  // Retorna a data remontada no padrão aceito pelo banco (AAAA-MM-DD)
  return `${ano}-${mes}-${dia}`; 
}

// Invoca a função para inicializar o pool/conexão com o banco de dados
const conexao = abrirConexao(); 

// Rota raiz (GET "/"): Envia o arquivo index.html da pasta public para o cliente
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "./public" }); 
});

// GET /tarefas - Rota para listar todas as tarefas cadastradas no banco
app.get("/tarefas", async (req, res) => {
  try {
    // Define o comando SQL para selecionar todos os registros da tabela de tarefas
    const sql = "SELECT * FROM tarefas"; 

    // Executa a consulta de forma assíncrona no banco de dados
    const resp = await conexao.query(sql); 

    // Retorna a lista de tarefas encontradas em formato JSON com status HTTP 200
    res.json(resp); 
  } catch (err) {
    // Em caso de erro, exibe o log no terminal para depuração
    console.log(err); 

    // Retorna resposta de erro interno do servidor (status 500) em formato JSON
    res.status(500).json({ erro: "Erro ao buscar as tarefas" }); 
  }
});

// GET /tarefas/periodo - Rota para listar tarefas ordenadas por data
app.get("/tarefas/periodo", async (req, res) => {
  try {
    // Define o comando SQL para consultar todas as tarefas ordenando de forma crescente pela data
    const sql = "SELECT * FROM tarefas ORDER BY data_tarefa ASC"; 

    // Executa a consulta SQL no banco de dados
    const resp = await conexao.query(sql); 

    // Retorna os dados ordenados em formato JSON
    res.json(resp); 
  } catch (err) {
    // Exibe a falha no console em caso de erro na consulta
    console.log(err); 

    // Envia o status HTTP 500 informando o erro
    res.status(500).json({ erro: "Erro ao buscar as tarefas" }); 
  }
});

// GET /tarefas/:id - Rota para buscar uma tarefa específica por seu ID
app.get("/tarefas/:id", async (req, res) => {
  // Converte o parâmetro "id" recebido na URL de String para Number
  const id = Number(req.params.id); 

  try {
    // Define a instrução SQL utilizando parâmetro preparado ("?") para prevenir SQL Injection
    const sql = "SELECT * FROM tarefas WHERE id_tarefa = ?"; 

    // Executa a consulta passando o ID como argumento do parâmetro preparado
    const resp = await conexao.query(sql, [id]); 

    // Verifica se a busca não retornou nenhum registro no banco
    if (resp.length === 0) {
      // Retorna resposta HTTP 404 (Não Encontrado) caso a tarefa não exista
      return res.status(404).json({ erro: "Tarefa não encontrada" }); 
    }

    // Retorna apenas a primeira tarefa localizada (o objeto único)
    res.json(resp[0]); 
  } catch (err) {
    // Exibe o erro no terminal
    console.log(err); 

    // Envia mensagem de erro com status 500
    res.status(500).json({ erro: "Erro ao buscar as tarefas" }); 
  }
});

// POST /cadastro - Rota para inserir uma nova tarefa na base de dados
app.post("/cadastro", async (req, res) => {
  // Extrai as propriedades do objeto req.body enviado na requisição
  const { nome, descricao, responsavel, data_tarefa, tarefa_concluida } = req.body; 

  // Validação: verifica se algum dos campos obrigatórios deixou de ser fornecido
  if (
    !nome ||
    !descricao ||
    !responsavel ||
    !data_tarefa ||
    tarefa_concluida === undefined
  ) {
    // Retorna código HTTP 400 (Bad Request) se faltar algum dado obrigatório
    return res
      .status(400)
      .json({ erro: "Todos os campos da tarefa são obrigatórios" }); 
  }

  // Formata a data recebida para o formato aceito pelo banco de dados
  const dataFormatada = formatarDataParaBD(data_tarefa); 

  // Declara a variável de conexão individual que será extraída do pool
  let com; 

  try {
    // Obtém uma conexão dedicada a partir do pool de conexões do banco
    com = await conexao.getConnection(); 

    // Executa o comando de inserção de dados com os parâmetros sanitizados
    const result = await com.query(
      "INSERT INTO tarefas (nome, descricao, responsavel, data_tarefa, tarefa_concluida) VALUES (?, ?, ?, ?, ?)", 
      [nome, descricao, responsavel, dataFormatada, tarefa_concluida]
    ); 

    // Retorna status HTTP 201 (Created) junto da mensagem e do ID gerado no banco
    res.status(201).json({
      mensagem: "Tarefa adicionada com sucesso!",
      id_inserido: Number(result.insertId),
    }); 
  } catch (err) {
    // Registra falhas de execução no console
    console.log(err); 

    // Retorna o status 500 em caso de problema no salvamento
    res.status(500).json({ erro: "Erro interno no servidor ao cadastrar" }); 
  } finally {
    // Garante a devolução/liberação da conexão ao pool, ocorra erro ou sucesso
    if (com) com.release(); 
  }
});

// PUT /tarefa/:id - Rota para atualizar os dados de uma tarefa existente
app.put("/tarefa/:id", async (req, res) => {
  // Obtém o ID enviado na rota e realiza a conversão para número
  const id = Number(req.params.id); 

  // Desestrutura as informações enviadas no corpo do registro para atualização
  const { nome, descricao, responsavel, data_tarefa, tarefa_concluida } = req.body; 

  // Trata e converte o campo de data para o formato correto
  const dataFormatada = formatarDataParaBD(data_tarefa); 

  // Prepara o comando SQL UPDATE utilizando parâmetros parametrizados
  const sql =
    "UPDATE tarefas SET nome = ?, descricao = ?, responsavel = ?, data_tarefa = ?, tarefa_concluida = ? WHERE id_tarefa = ?"; 

  try {
    // Executa a instrução de atualização no banco de dados
    const resp = await conexao.query(sql, [
      nome,
      descricao,
      responsavel,
      dataFormatada,
      tarefa_concluida,
      id,
    ]); 

    // Avalia se ao menos um registro foi de fato afetado/alterado
    if (resp.affectedRows > 0) {
      // Retorna sucesso na atualização
      res.json({ mensagem: "Tarefa atualizada com sucesso" }); 
    } else {
      // Retorna status 404 se o ID fornecido não bateu com nenhum registro existente
      res.status(404).json({ erro: "Tarefa não encontrada" }); 
    }
  } catch (err) {
    // Imprime o erro técnico ocorrido
    console.log(err); 

    // Retorna erro HTTP 500 no processamento da alteração
    res.status(500).json({ erro: "Erro interno no servidor ao atualizar" }); 
  }
});

// DELETE /tarefa/:id - Rota para remover uma tarefa da base de dados
app.delete("/tarefa/:id", async (req, res) => {
  // Extrai e converte o ID fornecido na requisição
  const id = Number(req.params.id); 

  try {
    // Prepara a instrução SQL de exclusão por ID
    const sql = "DELETE FROM tarefas WHERE id_tarefa = ?"; 

    // Executa a exclusão de forma assíncrona
    const resp = await conexao.query(sql, [id]); 

    // Verifica se nenhuma linha foi afetada pela remoção
    if (resp.affectedRows === 0) {
      // Retorna status 404 informando que o ID não foi encontrado no banco
      return res.status(404).json({ erro: "O ID inserido não existe" }); 
    }

    // Retorna confirmação da exclusão com código de sucesso 200 (OK)
    res.status(200).json({ mensagem: "Tarefa deletada com sucesso!" }); 
  } catch (err) {
    // Exibe detalhes do erro no terminal
    console.log(err); 

    // Retorna mensagem genérica de erro interno 500
    res.status(500).json({ erro: "Erro interno no servidor ao deletar" }); 
  }
});

// Define a porta do servidor obtida do .env ou assume 3000 por padrão
const PORT = process.env.PORT || 3000; 

// Coloca o servidor HTTP para escutar as requisições na porta configurada
app.listen(PORT, () => {
  // Imprime uma mensagem informando o endereço local onde o servidor está operando
  console.log(`Servidor rodando em http://localhost:${PORT}`); 
});