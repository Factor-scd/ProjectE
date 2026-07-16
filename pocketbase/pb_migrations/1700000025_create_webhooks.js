module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'webhooks',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'name',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'url',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'events',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'secret',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'active',
          type: 'bool',
          options: {}
        })
      ]),
      indexes: []
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('webhooks');
    return app.delete(collection);
  }
};
