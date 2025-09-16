import Product from '../models/Product';
import User from '../models/User';
import { getTreatment } from './db/treatment';

interface TreatmentProductAssociationResult {
    success: boolean;
    message: string;
    error?: string;
}

class TreatmentService {
    async associateProductsWithTreatment(
        treatmentId: string,
        productIds: string[],
        userId: string
    ): Promise<TreatmentProductAssociationResult> {
        try {
            // Get user and validate they are a doctor
            const user = await User.findByPk(userId);
            if (!user) {
                return {
                    success: false,
                    message: "User not found",
                    error: "User with the provided ID does not exist"
                };
            }

            if (user.role !== 'doctor') {
                return {
                    success: false,
                    message: "Access denied",
                    error: "Only doctors can associate products with treatments"
                };
            }

            const treatment = await getTreatment(treatmentId);

            if (!treatment) {
                return {
                    success: false,
                    message: "Treatment not found",
                    error: "Treatment with the provided ID does not exist"
                };
            }

            // Verify treatment belongs to user's clinic
            if (treatment.clinicId !== user.clinicId) {
                return {
                    success: false,
                    message: "Access denied",
                    error: "Treatment does not belong to your clinic"
                };
            }

            // Validate productIds is an array
            if (!Array.isArray(productIds)) {
                return {
                    success: false,
                    message: "Invalid input",
                    error: "productIds must be an array"
                };
            }

            // Validate that all products exist
            if (productIds.length > 0) {
                const products = await Product.findAll({
                    where: { id: productIds }
                });

                if (products.length !== productIds.length) {
                    const foundIds = products.map(p => p.id);
                    const missingIds = productIds.filter(id => !foundIds.includes(id));

                    return {
                        success: false,
                        message: "Some products not found",
                        error: `Products with IDs ${missingIds.join(', ')} do not exist`
                    };
                }
            }

            // Remove all existing associations for this treatment
            // This ensures we override/replace existing associations
            await treatment.$set('products', []);

            // Add new associations
            if (productIds.length > 0) {
                await treatment.$add('products', productIds);
            }

            return {
                success: true,
                message: `Successfully associated ${productIds.length} products with treatment`,
            };

        } catch (error) {
            console.error('Error associating products with treatment:', error);
            return {
                success: false,
                message: "Failed to associate products with treatment",
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

  
}

export default TreatmentService;
export { TreatmentProductAssociationResult };