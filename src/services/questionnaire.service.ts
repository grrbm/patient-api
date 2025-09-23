import Questionnaire from '../models/Questionnaire';
import QuestionnaireStep from '../models/QuestionnaireStep';
import Question from '../models/Question';
import QuestionOption from '../models/QuestionOption';
import Treatment from '../models/Treatment';
import User from '../models/User';

class QuestionnaireService {
    async validateQuestionnaireOperation(questionnaireId: string, userId: string) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const questionnaire = await Questionnaire.findByPk(questionnaireId, {
            include: [
                {
                    model: Treatment,
                    as: 'treatment'
                }
            ]
        });

        if (!questionnaire) {
            throw new Error('Questionnaire not found');
        }

        if (questionnaire.treatment.clinicId !== user.clinicId) {
            throw new Error('Questionnaire does not belong to your clinic');
        }

        return { user, questionnaire };
    }

    async createDefaultQuestionnaire(treatmentId: string): Promise<Questionnaire> {
        const treatment = await Treatment.findByPk(treatmentId);

        if (!treatment) {
            throw new Error('Treatment not found');
        }

        const questionnaire = await Questionnaire.create({
            title: `${treatment.name} Intake Form`,
            description: `Medical intake questionnaire for ${treatment.name} treatment`,
            checkoutStepPosition: -1,
            treatmentId: treatmentId
        });

        // Step 1: How are you feeling?
        const step1 = await QuestionnaireStep.create({
            title: 'How are you feeling?',
            description: '',
            stepOrder: 1,
            questionnaireId: questionnaire.id
        });

        const question1 = await Question.create({
            questionText: 'How are you feeling?',
            answerType: 'select',
            isRequired: true,
            questionOrder: 1,
            stepId: step1.id
        });

        await QuestionOption.bulkCreate([
            { optionText: 'Low Energy', optionValue: 'low_energy', optionOrder: 1, questionId: question1.id },
            { optionText: 'Brain Fog', optionValue: 'brain_fog', optionOrder: 2, questionId: question1.id },
            { optionText: 'Bad sleep', optionValue: 'bad_sleep', optionOrder: 3, questionId: question1.id }
        ]);

        // Step 2: Treatment Information
        const step2 = await QuestionnaireStep.create({
            title: 'Treatment Information',
            description: 'Treatment Information 83% of limitless patients report that Performance medication makes them more motivated',
            stepOrder: 2,
            questionnaireId: questionnaire.id
        });

        await Question.create({
            questionText: 'Treatment Information',
            answerType: 'text',
            isRequired: true,
            questionOrder: 1,
            stepId: step2.id
        });

        // Step 3: What state do you live in?
        const step3 = await QuestionnaireStep.create({
            title: 'Location Information',
            description: '',
            stepOrder: 3,
            questionnaireId: questionnaire.id
        });

        await Question.create({
            questionText: 'What state do you live in?',
            answerType: 'select',
            isRequired: true,
            questionOrder: 1,
            stepId: step3.id
        });

        // Step 4: Gender at birth
        const step4 = await QuestionnaireStep.create({
            title: 'Personal Information',
            description: '',
            stepOrder: 4,
            questionnaireId: questionnaire.id
        });

        const question4 = await Question.create({
            questionText: "What's your gender at birth?",
            answerType: 'radio',
            isRequired: true,
            questionOrder: 1,
            stepId: step4.id
        });

        await QuestionOption.bulkCreate([
            { optionText: 'Male', optionValue: 'male', optionOrder: 1, questionId: question4.id },
            { optionText: 'Female', optionValue: 'female', optionOrder: 2, questionId: question4.id }
        ]);

        // Step 5: Date of birth
        const step5 = await QuestionnaireStep.create({
            title: 'Date of Birth',
            description: '',
            stepOrder: 5,
            questionnaireId: questionnaire.id
        });

        await Question.create({
            questionText: 'Date of birth',
            answerType: 'date',
            isRequired: true,
            questionOrder: 1,
            stepId: step5.id
        });

        // Step 6: Personal information
        const step6 = await QuestionnaireStep.create({
            title: 'Personal information',
            description: '',
            stepOrder: 6,
            questionnaireId: questionnaire.id
        });

        await Question.bulkCreate([
            {
                questionText: 'First name',
                answerType: 'text',
                isRequired: true,
                questionOrder: 1,
                stepId: step6.id
            },
            {
                questionText: 'Last name',
                answerType: 'text',
                isRequired: true,
                questionOrder: 2,
                stepId: step6.id
            },
            {
                questionText: 'Email',
                answerType: 'email',
                isRequired: true,
                questionOrder: 3,
                stepId: step6.id
            },
            {
                questionText: 'Phone number',
                answerType: 'phone',
                isRequired: true,
                questionOrder: 4,
                stepId: step6.id
            }
        ]);

        return questionnaire;
    }

    async addQuestionnaireStep(questionnaireId: string, userId: string) {
        // Validate questionnaire operation permission
        await this.validateQuestionnaireOperation(questionnaireId, userId);

        const existingSteps = await QuestionnaireStep.findAll({
            where: { questionnaireId },
            order: [['stepOrder', 'DESC']],
            limit: 1
        });

        const nextStepOrder = existingSteps.length > 0 ? existingSteps[0].stepOrder + 1 : 1;

        const newStep = await QuestionnaireStep.create({
            title: 'New Step',
            description: '',
            stepOrder: nextStepOrder,
            questionnaireId: questionnaireId
        });

        return newStep;

    }

    async updateQuestionnaireStep(stepId: string, updateData: { title?: string; description?: string }, userId: string) {
        const step = await QuestionnaireStep.findByPk(stepId);
        if (!step) {
            throw new Error('Questionnaire step not found');
        }

        // Validate questionnaire operation permission
        await this.validateQuestionnaireOperation(step.questionnaireId, userId);

        // Update step with provided data
        const updatedStep = await step.update({
            ...(updateData.title !== undefined && { title: updateData.title }),
            ...(updateData.description !== undefined && { description: updateData.description })
        });

        return updatedStep;
    }

    async deleteQuestionnaireStep(stepId: string, userId: string) {
        const step = await QuestionnaireStep.findByPk(stepId, {
            include: [
                {
                    model: Question,
                    as: 'questions'
                }
            ]
        });

        if (!step) {
            throw new Error('Questionnaire step not found');
        }

        // Validate questionnaire operation permission
        await this.validateQuestionnaireOperation(step.questionnaireId, userId);

        // Delete all questions associated with this step first
        if (step.questions && step.questions.length > 0) {
            for (const question of step.questions) {
                // Delete question options first
                await QuestionOption.destroy({
                    where: { questionId: question.id }
                });

                // Then delete the question
                await Question.destroy({
                    where: { id: question.id }
                });
            }
        }

        // Delete the step
        await QuestionnaireStep.destroy({
            where: { id: stepId }
        });

        return { deleted: true, stepId };
    }

    async saveStepsOrder(steps: Array<{ id: string; stepOrder: number }>, questionnaireId: string, userId: string) {

        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            throw new Error('Steps array is required and cannot be empty');
        }

        // Validate questionnaire operation permission
        await this.validateQuestionnaireOperation(questionnaireId, userId);

        // Get all step IDs to validate they exist and belong to the questionnaire
        const stepIds = steps.map(step => step.id);
        const existingSteps = await QuestionnaireStep.findAll({
            where: {
                id: stepIds,
                questionnaireId: questionnaireId
            }
        });

        if (existingSteps.length !== steps.length) {
            throw new Error('One or more steps not found or do not belong to the questionnaire');
        }

        // Update step orders
        const updatePromises = steps.map(step =>
            QuestionnaireStep.update(
                { stepOrder: step.stepOrder },
                { where: { id: step.id } }
            )
        );

        await Promise.all(updatePromises);

        // Return updated steps
        const updatedSteps = await QuestionnaireStep.findAll({
            where: { id: stepIds },
            order: [['stepOrder', 'ASC']]
        });

        return updatedSteps;
    }
}

export default QuestionnaireService;