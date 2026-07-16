module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'canvas_cards',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'canvas_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'canvases', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'card_type',
          type: 'select',
          options: { values: ['note', 'task', 'image', 'entity'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'entity_id',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'entity_type',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'position_x',
          type: 'number',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'position_y',
          type: 'number',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'width',
          type: 'number',
          options: { min: 1 }
        }),
        app.models.NewSchemaField({
          name: 'height',
          type: 'number',
          options: { min: 1 }
        }),
        app.models.NewSchemaField({
          name: 'content',
          type: 'json',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_canvas_cards_canvas_id ON canvas_cards (canvas_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('canvas_cards');
    return app.delete(collection);
  }
};
