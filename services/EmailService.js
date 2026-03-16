'use strict';
const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendWelcomeEmail(email, name, tempPassword) {
        const mailOptions = {
            from: `"Red Hidro" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Bienvenido a Observatorio Hidrometeorológico',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h2 style="color: #2c3e50; text-align: center;">¡Bienvenido a Observatorio Hidrometeorológico!</h2>
                        <p style="color: #555;">Hola <strong>${name}</strong>,</p>
                        <p style="color: #555;">Tu cuenta ha sido registrada exitosamente. A continuación, encontrarás tus credenciales de acceso:</p>
                        <div style="background-color: #ecf0f1; padding: 15px; border-radius: 4px; border: 1px solid #bdc3c7;">
                            <p style="margin: 0;"><strong>Usuario (Correo):</strong> ${email}</p>
                            <p style="margin: 10px 0 0 0;"><strong>Contraseña Temporal:</strong> Su contraseña para el primer acceso es su número de identificación (cédula / pasaporte)</p>
                        </div>
                        <p style="color: #555; margin-top: 20px;">
                            Por motivos de seguridad, se te solicitará cambiar esta contraseña en tu primer inicio de sesión.
                            <br>
                            La nueva contraseña debe cumplir con los siguientes requisitos:
                        </p>
                        <ul style="color: #555;">
                            <li>Más de 8 caracteres</li>
                            <li>Al menos una mayúscula</li>
                            <li>Al menos un número</li>
                            <li>Al menos un carácter especial</li>
                        </ul>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${process.env.FRONTEND_URL || 'https://observatorio-web.vercel.app'}/admin" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Iniciar Sesión</a>
                        </div>
                    </div>
                </div>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Correo de bienvenida enviado a ${email}`);
        } catch (error) {
            console.error('Error enviando correo de bienvenida:', error);
        }
    }

    async sendResetPasswordEmail(email, token) {
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/restablecer-clave/${token}`;

        const mailOptions = {
            from: `"Red Hidro" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Restabler Contraseña - Observatorio Hidrometeorológico',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h2 style="color: #2c3e50; text-align: center;">Recuperación de Contraseña</h2>
                        <p style="color: #555;">Hola,</p>
                        <p style="color: #555;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta asociada a <strong>${email}</strong>.</p>
                        <p style="color: #555;">Haz clic en el siguiente botón para crear una nueva contraseña:</p>
                        <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
                            <a href="${resetLink}" style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Restablecer Contraseña</a>
                        </div>
                        <p style="color: #555; font-size: 12px;">
                            Si no solicitaste este cambio, puedes ignorar este correo. El enlace expirará en 1 hora.
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Correo de recuperación enviado a ${email}`);
        } catch (error) {
            console.error('Error enviando correo de recuperación:', error);
            throw { message: "Error al enviar el correo", code: 500 };
        }
    }
}

module.exports = new EmailService();
