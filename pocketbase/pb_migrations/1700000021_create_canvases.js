module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'canvases',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'name',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'mode',
          type: 'select',
          options: { values: ['freeform', 'graph'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'project_id',
          type: 'relation',
          options: { collectionId: 'projects', maxSelect: 1, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'state',
          type: 'json',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_canvases_project_id ON canvases (project_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('canvases');
    return app.delete(collection);
  }
};
