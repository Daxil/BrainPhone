import { db } from './config/database';

async function clearDatabase() {
  try {
    console.log('Очистка базы данных...');

    await db.none('TRUNCATE TABLE patient_audio RESTART IDENTITY CASCADE;');
    console.log(' patient_audio очищена');

    await db.none('TRUNCATE TABLE patient_photos RESTART IDENTITY CASCADE;');
    console.log(' patient_photos очищена');

    await db.none('TRUNCATE TABLE patients RESTART IDENTITY CASCADE;');
    console.log('patients очищена');

    console.log(' Все данные удалены!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Ошибка очистки БД:', error.message);
    process.exit(1);
  }
}

clearDatabase();
