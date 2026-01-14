module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/order/send-email',
      handler: 'api::order.order.sendEmail',
      config: {
        auth: false,
      },
    },
  ],
};
