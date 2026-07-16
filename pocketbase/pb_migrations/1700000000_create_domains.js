module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'domains',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'name',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'color',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'icon',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'sort_order',
          type: 'number',
          options: {}
        })
      ]),
      indexes: [
        'CREATE UNIQUE INDEX idx_domains_name ON domains (name)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('domains');
    return app.delete(collection);
  }
};
