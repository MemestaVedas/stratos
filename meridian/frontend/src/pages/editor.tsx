import DAGEditor from '@/components/editor/DAGEditor';

export default function WorkflowEditorPage() {
  const handleSave = (data: any) => {
    console.log('Saved:', data);
  };

  const handleRun = () => {
    console.log('Running workflow...');
  };

  return (
    <DAGEditor
      workflowId="wf_demo_12345"
      workflowName="Customer Data Processing Pipeline"
      onSave={handleSave}
      onRun={handleRun}
    />
  );
}
