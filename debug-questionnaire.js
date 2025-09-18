// Quick debug script to check what's in the database
const { Sequelize } = require('sequelize');

const DATABASE_URL = "postgresql://fusehealth_user:e4Uv%24%5E9hJG%3AK%2A%29s%25@database-1.cv8g82kya3xt.us-east-2.rds.amazonaws.com:5432/fusehealth_database";

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

async function debug() {
  try {
    // Check questionnaire
    const [questionnaires] = await sequelize.query(`
      SELECT q.id, q.title, t.name as treatment_name
      FROM "Questionnaire" q
      JOIN "Treatment" t ON q."treatmentId" = t.id
      WHERE t.name = 'Weight Loss 2'
    `);
    
    console.log('Questionnaires found:', questionnaires);
    
    if (questionnaires.length > 0) {
      const questionnaireId = questionnaires[0].id;
      
      // Check steps
      const [steps] = await sequelize.query(`
        SELECT id, title, "stepOrder"
        FROM "QuestionnaireStep"
        WHERE "questionnaireId" = ?
        ORDER BY "stepOrder"
      `, {
        replacements: [questionnaireId]
      });
      
      console.log('Steps found:', steps);
      
      // Check questions
      const [questions] = await sequelize.query(`
        SELECT q.id, q."questionText", qs."stepOrder"
        FROM "Question" q
        JOIN "QuestionnaireStep" qs ON q."stepId" = qs.id
        WHERE qs."questionnaireId" = ?
        ORDER BY qs."stepOrder", q."questionOrder"
      `, {
        replacements: [questionnaireId]
      });
      
      console.log('Questions found:', questions);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

debug();