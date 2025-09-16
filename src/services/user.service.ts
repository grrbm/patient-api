import User from '../models/User';
import { getUser, updateUser } from './db/user';
import PatientService, { CreatePatientRequest, PatientAddress } from './pharmacy/patient';

interface UserToPatientValidationResult {
    valid: boolean;
    missingFields: string[];
    errorMessage?: string;
}

class UserService {
    private patientService: PatientService;

    constructor() {
        this.patientService = new PatientService();
    }



    validateUserForPatientCreation(user: User): UserToPatientValidationResult {
        const missingFields: string[] = [];

        // Required string fields for CreatePatientRequest
        if (!user.firstName?.trim()) {
            missingFields.push('firstName (first_name)');
        }
        if (!user.lastName?.trim()) {
            missingFields.push('lastName (last_name)');
        }
        if (!user.dob) {
            missingFields.push('dob (date of birth in YYYY-MM-DD format)');
        }
        if (!user.gender?.trim()) {
            missingFields.push('gender');
        }
        if (!user.email?.trim()) {
            missingFields.push('email');
        }
        if (!user.phoneNumber?.trim()) {
            missingFields.push('phoneNumber (phone_number)');
        }

        // Required array fields for CreatePatientRequest
        if (!user.allergies || !Array.isArray(user.allergies)) {
            missingFields.push('allergies (must be an array)');
        }
        if (!user.diseases || !Array.isArray(user.diseases)) {
            missingFields.push('diseases (must be an array)');
        }
        if (!user.medications || !Array.isArray(user.medications)) {
            missingFields.push('medications (must be an array)');
        }

        // Required address fields for CreatePatientRequest
        if (!user.address?.trim()) {
            missingFields.push('address (street)');
        }
        if (!user.city?.trim()) {
            missingFields.push('city');
        }
        if (!user.state?.trim()) {
            missingFields.push('state');
        }
        if (!user.zipCode?.trim()) {
            missingFields.push('zipCode (zip)');
        }

        if (missingFields.length > 0) {
            return {
                valid: false,
                missingFields,
                errorMessage: `Missing required fields for patient creation: ${missingFields.join(', ')}`
            };
        }

        return {
            valid: true,
            missingFields: []
        };
    }

    mapUserToPatientRequest(user: User): CreatePatientRequest {
        const address: PatientAddress = {
            street: user.address!,
            city: user.city!,
            state: user.state!,
            zip: user.zipCode!
        };

        return {
            first_name: user.firstName,
            last_name: user.lastName,
            dob: user.dob!, // Format: YYYY-MM-DD
            gender: user.gender!,
            allergies: user.allergies!,
            diseases: user.diseases!,
            medications: user.medications!,
            email: user.email,
            phone_number: user.phoneNumber!,
            address: address
        };
    }

    async syncPatientFromUser(userId: string) {
        try {
            const user = await getUser(userId);

            if (!user) {
                throw Error("User not found")
            }

            const validation = this.validateUserForPatientCreation(user);

            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.errorMessage,
                    missingFields: validation.missingFields
                };
            }

            const patientRequest = this.mapUserToPatientRequest(user);

            // Check if user already has a pharmacy patient ID
            if (!user.pharmacyPatientId) {
                // Create new patient
                const result = await this.patientService.createPatient(patientRequest);

                // If creation successful, save the pharmacy patient ID to user
                if (result.success && result.data?.id) {
                    await User.update(
                        { pharmacyPatientId: result.data.id },
                        { where: { id: userId } }
                    );
                }

            } else {
                // Update existing patient
                await this.patientService.updatePatient(
                    parseInt(user.pharmacyPatientId),
                    patientRequest
                );
            }

        } catch (error) {
            console.error('Error syncing patient from user:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    async updateUserPatient(userId: string, updateData: Partial<User>) {
        try {
            const user = await getUser(userId);

            if (!user) {
                return {
                    success: false,
                    error: "User not found"
                };
            }

            // Validate user is a patient
            if (user.role !== 'patient') {
                return {
                    success: false,
                    error: "Only patient users can be updated through this method"
                };
            }

            // Update user in database
            await updateUser(userId, updateData);


            // Attempt to sync patient data with pharmacy
            await this.syncPatientFromUser(userId);

            return {
                success: true,
                message: "User updated successfully",
            };

        } catch (error) {
            console.error('Error updating user:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}

export default UserService;
export { UserToPatientValidationResult };