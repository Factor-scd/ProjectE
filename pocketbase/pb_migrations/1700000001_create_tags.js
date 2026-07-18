exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'tags',
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
        })
      ]),
      indexes: [
        'CREATE UNIQUE INDEX idx_tags_name ON tags (name)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('tags');
    return app.delete(collection);
  }
};
