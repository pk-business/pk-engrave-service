module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/order/send-email',
      handler: 'order.sendEmail',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
