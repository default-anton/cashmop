import React, { useState } from 'react';
import { ArrowRight, Save, Upload, CheckCircle2 } from 'lucide-react';
import {
  Card,
  Header,
  Button,
  DropTarget,
  FieldMeta,
  SingleMappingPill,
  Pill,
  DragReorderableList,
  Select,
  Input,
  Badge,
  Divider,
  Tabs,
  ProgressBar,
  Toast,
  Modal,
  Tooltip,
  LoadingSpinner,
  Accordion,
  Table,
} from './index';

const ExampleUsage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('basic');
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [items, setItems] = useState(['Item 1', 'Item 2', 'Item 3']);
  const [progress, setProgress] = useState(65);

  const tableData = [
    { id: 1, name: 'Transaction 1', amount: 100.5, status: 'completed' },
    { id: 2, name: 'Transaction 2', amount: -50.25, status: 'pending' },
    { id: 3, name: 'Transaction 3', amount: 200.0, status: 'completed' },
  ];

  const tableColumns = [
    { key: 'id' as const, header: 'ID' },
    { key: 'name' as const, header: 'Name' },
    { 
      key: 'amount' as const, 
      header: 'Amount',
      render: (value: number) => (
        <span className={value >= 0 ? 'text-finance-income' : 'text-finance-expense'}>
          ${Math.abs(value).toFixed(2)}
        </span>
      )
    },
    { 
      key: 'status' as const, 
      header: 'Status',
      render: (value: string) => (
        <Badge variant={value === 'completed' ? 'success' : 'warning'}>
          {value}
        </Badge>
      )
    },
  ];

  const accordionItems = [
    {
      id: 'section1',
      title: 'Section 1',
      content: <p className="text-sm text-canvas-600">Content for section 1</p>,
    },
    {
      id: 'section2',
      title: 'Section 2',
      content: <p className="text-sm text-canvas-600">Content for section 2</p>,
    },
  ];

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-canvas-800">Design System Examples</h1>
        <div className="flex items-center gap-2">
          <Badge variant="success">Active</Badge>
          <Badge variant="info">v1.0.0</Badge>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'basic', label: 'Basic Components' },
          { id: 'advanced', label: 'Advanced Components' },
          { id: 'data', label: 'Data Display' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'basic' && (
        <div className="space-y-6">
          <Card variant="elevated" className="p-6">
            <h3 className="text-lg font-semibold text-canvas-800 mb-4">Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <Button variant="primary">
                <ArrowRight className="w-4 h-4" />
                Primary Button
              </Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button disabled>Disabled Button</Button>
            </div>
          </Card>

          <Card variant="elevated" className="p-6">
            <h3 className="text-lg font-semibold text-canvas-800 mb-4">Form Elements</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-canvas-700 mb-1">Select</label>
                  <Select
                    options={[
                      { value: 'option1', label: 'Option 1' },
                      { value: 'option2', label: 'Option 2' },
                      { value: 'option3', label: 'Option 3' },
                    ]}
                    placeholder="Choose an option"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-canvas-700 mb-1">Input</label>
                  <Input placeholder="Enter text" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-canvas-700 mb-1">Mono Input</label>
                  <Input variant="mono" placeholder="monospace text" />
                </div>
              </div>
              <div className="space-y-4">
                <DropTarget>
                  <FieldMeta label="Date" required />
                  <SingleMappingPill value="" placeholder="Drop column here" />
                </DropTarget>
                <div>
                  <FieldMeta label="Description" required hint="Drag and drop columns" />
                  <div className="mt-2">
                    <DragReorderableList
                      items={items}
                      renderItem={(item) => item}
                      onReorder={(from, to) => {
                        const newItems = [...items];
                        const [removed] = newItems.splice(from, 1);
                        newItems.splice(to, 0, removed);
                        setItems(newItems);
                      }}
                      onRemove={(index) => {
                        setItems(items.filter((_, i) => i !== index));
                      }}
                      emptyPlaceholder={<div className="text-sm text-canvas-500">No items</div>}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="space-y-6">
          <Card variant="elevated" className="p-6">
            <h3 className="text-lg font-semibold text-canvas-800 mb-4">Interactive Components</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Tooltip content="This is a tooltip" position="top">
                  <Button variant="secondary">Hover for tooltip</Button>
                </Tooltip>
                <Button onClick={() => setShowModal(true)} variant="secondary">
                  Open Modal
                </Button>
                <Button onClick={() => setShowToast(true)} variant="secondary">
                  Show Toast
                </Button>
                <LoadingSpinner size="md" />
              </div>

              <Divider />

              <div>
                <h4 className="text-sm font-semibold text-canvas-700 mb-2">Progress Bar</h4>
                <ProgressBar
                  value={progress}
                  max={100}
                  showLabel
                  variant="success"
                  size="md"
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => setProgress(Math.max(0, progress - 10))}>
                    -10%
                  </Button>
                  <Button size="sm" onClick={() => setProgress(Math.min(100, progress + 10))}>
                    +10%
                  </Button>
                </div>
              </div>

              <Divider />

              <div>
                <h4 className="text-sm font-semibold text-canvas-700 mb-2">Accordion</h4>
                <Accordion items={accordionItems} allowMultiple={false} />
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'data' && (
        <div className="space-y-6">
          <Card variant="elevated" className="p-6">
            <Header title="Transactions">
              <Button variant="primary" size="sm">
                <Upload className="w-4 h-4" />
                Import
              </Button>
            </Header>
            <div className="p-4">
              <Table
                columns={tableColumns}
                data={tableData}
                emptyMessage="No transactions found"
              />
            </div>
          </Card>

          <Card variant="elevated" className="p-6">
            <h3 className="text-lg font-semibold text-canvas-800 mb-4">Pills & Badges</h3>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Pill onRemove={() => {}}>Removable Pill</Pill>
                <Pill>Static Pill</Pill>
                <Badge variant="success">Success</Badge>
                <Badge variant="error">Error</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="default">Default</Badge>
              </div>
              <div className="text-sm text-canvas-500">
                Pills are for user-managed tags, Badges are for system status.
              </div>
            </div>
          </Card>
        </div>
      )}

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Example Modal"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-canvas-600">
              This is an example modal using the design system components.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setShowModal(false)}>
                Confirm
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showToast && (
        <div className="fixed bottom-4 right-4 z-50">
          <Toast
            message="Operation completed successfully!"
            type="success"
            duration={3000}
            onClose={() => setShowToast(false)}
          />
        </div>
      )}
    </div>
  );
};

export default ExampleUsage;