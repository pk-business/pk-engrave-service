const nodemailer = require('nodemailer');

module.exports = {
  async sendEmail(ctx) {
    try {
      const { to, orderData } = ctx.request.body;

      if (!to || !orderData) {
        return ctx.badRequest('Missing required fields');
      }

      // Create email transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Format order items HTML
      const itemsHtml = orderData.items
        .map(
          (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">
            ${item.productName}
            ${
              item.customization
                ? `<br><small style="color: #666; line-height: 1.6;">
                ${item.customization.selectedSize ? `<strong>Size:</strong> ${item.customization.selectedSize}<br>` : ''}
                ${item.customization.customText ? `<strong>Text:</strong> "${item.customization.customText}"<br>` : ''}
                ${item.customization.imageName ? `<strong>Image:</strong> ${item.customization.imageName} (see attachment)<br>` : ''}
                ${
                  item.customization.customizationInstructions
                    ? `<strong>Instructions:</strong> ${item.customization.customizationInstructions}<br>`
                    : ''
                }
              </small>`
                : ''
            }
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right;">$${item.price.toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600;">$${item.totalPrice.toFixed(2)}</td>
        </tr>
      `
        )
        .join('');

      // Email HTML template
      const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
        <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #2FA4A9; margin-top: 0;">New Order Received</h1>
          <p style="color: #666; font-size: 14px;">Order Date: ${new Date(orderData.orderDate).toLocaleString()}</p>
          
          <h2 style="color: #333; margin-top: 30px; border-bottom: 2px solid #2FA4A9; padding-bottom: 10px;">Customer Information</h2>
          <p><strong>Email:</strong> ${orderData.customer.email}</p>
          <p><strong>Phone:</strong> ${orderData.customer.phone}</p>
          
          <h2 style="color: #333; margin-top: 30px; border-bottom: 2px solid #2FA4A9; padding-bottom: 10px;">Shipping Address</h2>
          <p style="margin: 5px 0;">${orderData.shippingAddress.fullName}</p>
          <p style="margin: 5px 0;">${orderData.shippingAddress.addressLine1}</p>
          ${orderData.shippingAddress.addressLine2 ? `<p style="margin: 5px 0;">${orderData.shippingAddress.addressLine2}</p>` : ''}
          <p style="margin: 5px 0;">${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipCode}</p>
          <p style="margin: 5px 0;">${orderData.shippingAddress.country}</p>
          
          <h2 style="color: #333; margin-top: 30px; border-bottom: 2px solid #2FA4A9; padding-bottom: 10px;">Billing Address</h2>
          <p style="margin: 5px 0;">${orderData.billingAddress.fullName}</p>
          <p style="margin: 5px 0;">${orderData.billingAddress.addressLine1}</p>
          ${orderData.billingAddress.addressLine2 ? `<p style="margin: 5px 0;">${orderData.billingAddress.addressLine2}</p>` : ''}
          <p style="margin: 5px 0;">${orderData.billingAddress.city}, ${orderData.billingAddress.state} ${orderData.billingAddress.zipCode}</p>
          <p style="margin: 5px 0;">${orderData.billingAddress.country}</p>
          
          <h2 style="color: #333; margin-top: 30px; border-bottom: 2px solid #2FA4A9; padding-bottom: 10px;">Order Items</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Product</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <table style="width: 100%; max-width: 300px; margin-left: auto;">
              <tr>
                <td style="padding: 5px 0;"><strong>Subtotal:</strong></td>
                <td style="padding: 5px 0; text-align: right;">$${orderData.summary.subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Tax:</strong></td>
                <td style="padding: 5px 0; text-align: right;">$${orderData.summary.tax.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Shipping:</strong></td>
                <td style="padding: 5px 0; text-align: right;">$${orderData.summary.shipping.toFixed(2)}</td>
              </tr>
              <tr style="border-top: 2px solid #2FA4A9;">
                <td style="padding: 10px 0; font-size: 18px;"><strong>Total:</strong></td>
                <td style="padding: 10px 0; text-align: right; font-size: 18px; font-weight: bold; color: #2FA4A9;">$${orderData.summary.total.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          
          <h2 style="color: #333; margin-top: 30px; border-bottom: 2px solid #2FA4A9; padding-bottom: 10px;">Payment Information</h2>
          <p><strong>Method:</strong> ${orderData.payment.method.replace('_', ' ').toUpperCase()}</p>
          ${orderData.payment.cardLast4 ? `<p><strong>Card ending in:</strong> ${orderData.payment.cardLast4}</p>` : ''}
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; text-align: center;">
          This is an automated notification from your e-commerce system.
        </p>
      </div>
    `;

      // Collect image attachments from base64
      const attachments = [];
      orderData.items.forEach((item, index) => {
        if (item.customization?.customImageBase64) {
          const matches = item.customization.customImageBase64.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            const contentType = matches[1];
            const base64Data = matches[2];
            const extension = contentType.split('/')[1] || 'png';

            attachments.push({
              filename: item.customization.imageName || `custom-image-${index + 1}.${extension}`,
              content: base64Data,
              encoding: 'base64',
              contentType: contentType,
            });
          }
        }
      });

      // Prepare email options
      const mailOptions = {
        from: `"CustomCraft Orders" <${process.env.SMTP_USER}>`,
        to: to,
        subject: `New Order - $${orderData.summary.total.toFixed(2)}`,
        html: htmlContent,
      };

      // Add attachments if any
      if (attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

      // Send email
      const info = await transporter.sendMail(mailOptions);

      console.log('Order email sent:', info.messageId);
      ctx.send({ success: true, message: 'Order email sent successfully' });
    } catch (error) {
      console.error('Error sending order email:', error);
      ctx.throw(500, { message: 'Failed to send order email', error: error.message });
    }
  },
};
