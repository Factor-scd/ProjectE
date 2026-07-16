module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'note_task_links',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'note_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'notes', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'task_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'tasks', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'checkbox_position',
          type: 'number',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_note_task_links_note_id ON note_task_links (note_id)',
        'CREATE INDEX idx_note_task_links_task_id ON note_task_links (task_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('note_task_links');
    return app.delete(collection);
  }
};
