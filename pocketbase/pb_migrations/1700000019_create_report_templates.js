module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'report_templates',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'name',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'description',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'report_type',
          type: 'select',
          options: { values: ['weekly', 'monthly', 'project', 'habit', 'custom'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'content_template',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'is_builtin',
          type: 'bool',
          options: {}
        })
      ]),
      indexes: []
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('report_templates');
    return app.delete(collection);
  }
};
