const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5433,
  user: 'postgres',
  password: 'root',
  database: 'postgres'
});

client.connect()
  .then(() => {
    console.log('✅ ПОДКЛЮЧЕНИЕ УСПЕШНО');
    client.query('SELECT NOW() as time', (err, res) => {
      if (err) throw err;
      console.log('Время сервера:', res.rows[0].time);
      client.end();
    });
  })
  .catch(err => {
    console.error('❌ ОШИБКА:', err.message);
    process.exit(1);
  });
