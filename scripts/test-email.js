/**
 * Script de Teste de Envio de Email
 * Testa a configuração do Nodemailer e envio de emails
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('\n🔍 Verificando Configurações de Email...\n');
console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE);
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_SECURE:', process.env.EMAIL_SECURE);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***' : 'NÃO CONFIGURADO');
console.log('APP_URL:', process.env.APP_URL);

// Configurar transporter
let transporter;

try {
  if (process.env.EMAIL_SERVICE === 'smtp') {
    console.log('\n📧 Configurando SMTP customizado (Hostinger)...\n');
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
      port: parseInt(process.env.EMAIL_PORT || '465'),
      secure: process.env.EMAIL_SECURE === 'true' || true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  } else {
    console.log('\n📧 Configurando serviço de email (Gmail)...\n');
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // Verificar conexão
  console.log('✓ Transporter configurado com sucesso');
  
  transporter.verify((error, success) => {
    if (error) {
      console.error('\n❌ Erro ao conectar ao servidor de email:');
      console.error(error.message);
      console.error('\nDicas de resolução:');
      console.error('1. Verifique as credenciais em .env');
      console.error('2. Certifique-se de que EMAIL_USER e EMAIL_PASSWORD estão corretos');
      console.error('3. Se usar Gmail, ative "Senhas de aplicativo" em myaccount.google.com');
      console.error('4. Se usar Hostinger, verifique que o SMTP está habilitado na conta');
      console.error('5. Verifique firewall/antivírus bloqueando conexão SMTP');
      process.exit(1);
    } else {
      console.log('✓ Conexão com servidor de email verificada com sucesso!\n');
      
      // Testar envio
      const testEmail = process.env.EMAIL_USER; // Enviar para si mesmo
      const testToken = 'test-token-123abc-' + Date.now();
      
      console.log('📤 Tentando enviar email de teste...\n');
      
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: testEmail,
        subject: '🔐 Tuya Locks - Teste de Envio de Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
              <h2 style="color: white; margin: 0;">Tuya Locks</h2>
              <p style="color: rgba(255,255,255,0.9); margin: 0;">Email de Teste</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
              <h3 style="color: #333;">Teste de Recuperação de Senha</h3>
              
              <p style="color: #666; line-height: 1.6;">
                Este é um email de teste para verificar se a funcionalidade de recuperação de senha está funcionando corretamente.
              </p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #999; font-size: 12px;">Token de Teste:</p>
                <p style="margin: 10px 0; font-family: monospace; color: #667eea; word-break: break-all;">
                  ${testToken}
                </p>
              </div>
              
              <a href="${process.env.APP_URL}/reset-password.html?token=${testToken}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">
                Redefinir Senha (Link de Teste)
              </a>
              
              <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
                Este é um email de teste. Se você não solicitou, ignore este email.
              </p>
            </div>
          </div>
        `
      }, (error, info) => {
        if (error) {
          console.error('❌ Erro ao enviar email:');
          console.error(error.message);
          
          console.error('\n🔧 Informações de Debug:');
          console.error('- Erro code:', error.code);
          console.error('- Erro response:', error.response);
          
          console.error('\n💡 Possíveis soluções:');
          if (error.code === 'EAUTH') {
            console.error('  - Credenciais incorretas. Verifique EMAIL_USER e EMAIL_PASSWORD');
          } else if (error.code === 'ECONNREFUSED') {
            console.error('  - Não foi possível conectar ao servidor SMTP');
            console.error('  - Verifique HOST e PORT');
          } else if (error.code === 'ETIMEDOUT') {
            console.error('  - Timeout na conexão');
            console.error('  - Pode ser problema de firewall/rede');
          }
          process.exit(1);
        } else {
          console.log('✅ Email enviado com sucesso!\n');
          console.log('📊 Informações do envio:');
          console.log('- Message ID:', info.messageId);
          console.log('- Para:', testEmail);
          console.log('- Status:', 'Enviado com sucesso');
          console.log('\n💌 Verifique sua caixa de email (pode estar em Spam)');
          process.exit(0);
        }
      });
    }
  });

} catch (error) {
  console.error('❌ Erro ao configurar transporter:');
  console.error(error.message);
  process.exit(1);
}
