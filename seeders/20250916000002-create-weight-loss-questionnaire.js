'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Find the Weight Loss treatment
    const [treatments] = await queryInterface.sequelize.query(`
      SELECT id FROM "Treatment" WHERE name = 'Weight Loss'
    `);
    
    if (treatments.length === 0) {
      throw new Error('Weight Loss treatment not found. Please ensure treatments are seeded first.');
    }
    
    const weightLossTreatmentId = treatments[0].id;

    // Create the questionnaire with checkout step only
    const questionnaireId = require('uuid').v4();
    await queryInterface.bulkInsert('Questionnaire', [{
      id: questionnaireId,
      title: 'Weight Loss Checkout',
      description: 'Select your weight loss plan and complete your order',
      treatmentId: weightLossTreatmentId,
      checkoutStepPosition: 1, // Checkout step is the first and only step
      createdAt: new Date(),
      updatedAt: new Date()
    }]);

    // Create only the checkout step
    const steps = [
      {
        id: require('uuid').v4(),
        title: 'Choose Your Plan',
        description: 'Select your weight loss medication plan and complete your order',
        stepOrder: 1,
        questionnaireId: questionnaireId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('QuestionnaireStep', steps);

    console.log('✅ Weight Loss questionnaire with checkout step created successfully');
  },

  async down(queryInterface, Sequelize) {
    // Delete in reverse order due to foreign key constraints
    await queryInterface.bulkDelete('QuestionnaireStep', null, {});
    await queryInterface.bulkDelete('Questionnaire', { title: 'Weight Loss Checkout' }, {});
  }
};