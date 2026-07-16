module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'queue_jobs',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'job_type',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'payload',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'status',
          type: 'select',
          options: { values: ['pending', 'in_progress', 'completed', 'failed'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'attempts',
          type: 'number',
          options: { min: 0 }
        }),
        app.models.NewSchemaField({
          name: 'max_attempts',
          type: 'number',
          options: { min: 1 }
        }),
        app.models.NewSchemaField({
          name: 'error',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'scheduled_at',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'started_at',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'completed_at',
          type: 'date',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_queue_jobs_status ON queue_jobs (status)',
        'CREATE INDEX idx_queue_jobs_scheduled_at ON queue_jobs (scheduled_at)',
        'CREATE INDEX idx_queue_jobs_job_type ON queue_jobs (job_type)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('queue_jobs');
    return app.delete(collection);
  }
};
