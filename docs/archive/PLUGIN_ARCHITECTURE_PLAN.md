# Comprehensive Plugin Architecture Plan

## 🎯 **Core Concept: TextDocument as Single Source of Truth**

**CORRECTED ARCHITECTURE**: VS Code TextDocument remains the authoritative storage mechanism.

Current problematic flow:
```
User Input → React State → VS Code TextDocument → React State → Editor
```

New plugin-based flow:
```
User Input → Plugin → VS Code TextDocument → Extension → Plugin → Editor (via Lexical)
                ↑                                    ↓
                └─────── Single Round-trip Loop ──────┘
```

**Key Principle**: Plugin manages the **sync transport layer**, TextDocument manages **persistent storage**.

## 🗄️ **TextDocument Integration Strategy**

### **TextDocument as Authoritative Storage:**
1. **All persistent state** lives in VS Code's TextDocument
2. **Undo/redo operations** are handled by TextDocument's built-in history
3. **File save/load** operations work through TextDocument
4. **Multi-file operations** (find/replace across files) work naturally
5. **Version control** (git) sees TextDocument changes
6. **Extension ecosystem integration** (other extensions can see/modify content)

### **Plugin Role - Sync Transport Only:**
- **Batches and optimizes** communication between editor and TextDocument
- **Manages timing** to prevent race conditions  
- **Handles state transitions** during sync operations
- **Provides performance optimizations** (batching, deduplication)
- **Does NOT store content** - always defers to TextDocument authority

### **Critical Data Flow Responsibilities:**

```typescript
// CORRECT: TextDocument-centric architecture
User types "hello" rapidly:
├─ Plugin detects changes in Lexical editor
├─ Plugin batches changes (adaptive delay)  
├─ Plugin sends to VS Code extension via message
├─ Extension updates TextDocument (authoritative storage)
├─ Extension sends 'update' message back to webview  
├─ Plugin receives update and applies to editor
└─ Editor, Plugin state, and TextDocument are synchronized

Undo operation (Ctrl+Z):
├─ VS Code receives keyboard shortcut
├─ VS Code performs undo on TextDocument (authoritative operation)
├─ Extension detects TextDocument change
├─ Extension sends 'update' message to webview
├─ Plugin receives update and applies to editor
└─ Editor shows undone content from TextDocument
```

## 📋 **Phase 1: Plugin Foundation (Week 1)**

### 1.1 Create VSCode Sync Plugin Structure

```typescript
// webview-ui/src/plugins/vscSyncPlugin.ts
import { 
  realmPlugin, 
  Cell, 
  Signal, 
  createRootEditorSubscription$,
  addExportVisitor$,
  addImportVisitor$,
  useCellValue,
  usePublisher
} from '@mdxeditor/editor'

// Core state cells - these track sync state, NOT content storage
export const textDocumentContent$ = Cell<string>('') // Last confirmed TextDocument state
export const editorContent$ = Cell<string>('') // Current live editor content
export const syncState$ = Cell<SyncState>(SyncState.IDLE)
export const hasUnsavedChanges$ = Cell<boolean>(false)
export const pendingSyncContent$ = Cell<string | null>(null)

// Critical: TextDocument is the ONLY persistent storage
// Plugin cells are for transport/sync state management only

// Action signals - these replace our message passing
export const syncToVSCode$ = Signal<string>()
export const receiveFromVSCode$ = Signal<string>()
export const flushImmediate$ = Signal<void>()

// Configuration cell
export const syncConfig$ = Cell<{
  baseBatchDelay: number
  rapidTypingDelay: number
  rapidTypingThreshold: number
}>({
  baseBatchDelay: 50,
  rapidTypingDelay: 200, 
  rapidTypingThreshold: 300
})
```

### 1.2 Smart Batching Logic Inside Plugin

```typescript
// Internal plugin state (not exported)
const batchTimeout$ = Cell<NodeJS.Timeout | null>(null)
const pendingContent$ = Cell<string | null>(null)
const lastChangeTime$ = Cell<number>(0)
const isRapidTyping$ = Cell<boolean>(false)

export const vscSyncPlugin = realmPlugin({
  init(realm) {
    // 1. Listen to editor content changes and sync to TextDocument
    const createRootEditorSubscription = realm.pub(createRootEditorSubscription$)
    
    createRootEditorSubscription((rootEditor) => {
      return rootEditor.registerUpdateListener(({ editorState }) => {
        // Skip if we're applying updates FROM TextDocument
        if (realm.getValue(syncState$) === SyncState.APPLYING_FROM_TEXTDOCUMENT) {
          return
        }
        
        const content = editorState.read(() => {
          // Extract markdown from Lexical state - use MDX's proper export
          return rootEditor.getMarkdown() // Use MDX Editor's built-in export
        })
        
        // Update our tracking of editor content
        realm.pub(editorContent$, content)
        
        // Check if content differs from last known TextDocument state
        const lastTextDocContent = realm.getValue(textDocumentContent$)
        if (content !== lastTextDocContent) {
          realm.pub(hasUnsavedChanges$, true)
          realm.pub(syncToVSCode$, content) // Trigger sync to TextDocument
        }
      })
    })
    
    // 2. Smart batching logic
    realm.sub(syncToVSCode$, (content) => {
      // Skip if already syncing or external update
      const currentState = realm.getValue(syncState$)
      if (currentState === SyncState.SENDING_TO_VSCODE || 
          currentState === SyncState.APPLYING_EXTERNAL) {
        return
      }
      
      const now = Date.now()
      const lastChange = realm.getValue(lastChangeTime$)
      const timeSinceLastChange = now - lastChange
      
      realm.pub(lastChangeTime$, now)
      realm.pub(isRapidTyping$, timeSinceLastChange < 300)
      
      // Store pending content
      realm.pub(pendingContent$, content)
      
      // Clear existing timeout
      const existingTimeout = realm.getValue(batchTimeout$)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }
      
      // Set adaptive delay
      const config = realm.getValue(syncConfig$)
      const delay = realm.getValue(isRapidTyping$) 
        ? config.rapidTypingDelay 
        : config.baseBatchDelay
      
      // Schedule batch flush
      const timeout = setTimeout(() => {
        realm.pub(flushBatch$, undefined)
      }, delay)
      
      realm.pub(batchTimeout$, timeout)
    })
    
    // 3. Batch flush logic
    realm.sub(flushBatch$, () => {
      const content = realm.getValue(pendingContent$)
      if (!content) return
      
      realm.pub(pendingContent$, null)
      realm.pub(batchTimeout$, null)
      realm.pub(syncState$, SyncState.SENDING_TO_VSCODE)
      
      // Send to VS Code
      if (typeof window !== 'undefined' && window.vscodeApi) {
        window.vscodeApi.postMessage({
          command: 'edit',
          content: content
        })
        
        // Update state tracking
        realm.pub(hasUnsavedChanges$, true)
        realm.pub(isDirty$, true)
      }
      
      // Reset state after brief delay
      setTimeout(() => {
        realm.pub(syncState$, SyncState.IDLE)
      }, 100)
    })
    
    // 4. Handle updates FROM TextDocument (undo/redo, external changes, file load)
    realm.sub(receiveFromVSCode$, (content) => {
      console.debug('Plugin: Receiving content from TextDocument via extension')
      
      realm.pub(syncState$, SyncState.APPLYING_FROM_TEXTDOCUMENT)
      realm.pub(textDocumentContent$, content) // Update our record of TextDocument state
      
      // Apply content to editor via MDX Editor's built-in import
      const rootEditor = realm.getValue(rootEditor$) // Access to root editor
      if (rootEditor) {
        // Use MDX Editor's setMarkdown method which properly handles import
        rootEditor.setMarkdown(content)
      }
      
      // Reset state - content is now synchronized
      setTimeout(() => {
        realm.pub(syncState$, SyncState.IDLE)
        realm.pub(hasUnsavedChanges$, false)
        realm.pub(editorContent$, content) // Editor content now matches TextDocument
      }, 100)
    })
    
    // 5. Immediate flush for save operations
    realm.sub(flushImmediate$, () => {
      const existingTimeout = realm.getValue(batchTimeout$)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
        realm.pub(flushBatch$, undefined)
      }
    })
  }
})

// Helper signal for batch flushing
const flushBatch$ = Signal<void>()
```

### 1.3 React Integration Hooks

```typescript
// webview-ui/src/hooks/useVSCodeSync.ts
export const useVSCodeSync = () => {
  const syncState = useCellValue(syncState$)
  const hasUnsavedChanges = useCellValue(hasUnsavedChanges$)
  const isDirty = useCellValue(isDirty$)
  const isRapidTyping = useCellValue(isRapidTyping$)
  
  const receiveFromVSCode = usePublisher(receiveFromVSCode$)
  const flushImmediate = usePublisher(flushImmediate$)
  const setSyncConfig = usePublisher(syncConfig$)
  
  return {
    // State
    syncState,
    hasUnsavedChanges,
    isDirty,
    isRapidTyping,
    
    // Actions
    receiveFromVSCode,
    flushImmediate,
    setSyncConfig,
    
    // Status checks
    canEdit: syncState !== SyncState.APPLYING_EXTERNAL,
    isSyncing: syncState === SyncState.SENDING_TO_VSCODE
  }
}
```

## 📋 **Phase 2: React Component Migration (Week 1-2)**

### 2.1 Update EditorApp.tsx

```typescript
// webview-ui/src/EditorApp.tsx
function EditorApp() {
  // Remove markdown state - it's now in the plugin
  // const [markdown, setMarkdown] = useState(''); // REMOVE THIS
  
  const [comments, setComments] = useState<CommentWithAnchor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [defaultFont, setDefaultFont] = useState<FontFamily>('Arial')
  
  // Use plugin state instead
  const { receiveFromVSCode, hasUnsavedChanges } = useVSCodeSync()
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      
      switch (message.command) {
        case 'update':
          // Send directly to plugin instead of React state
          receiveFromVSCode(message.content || '')
          setIsLoading(false)
          break
        case 'updateComments':
          setComments(message.comments || [])
          break
        // ... other cases
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [receiveFromVSCode])
  
  return (
    <MDXEditorWrapper
      // Remove markdown prop - plugin handles content
      comments={comments}
      defaultFont={defaultFont}
      onDirtyStateChange={handleDirtyStateChange}
      vscode={vscode}
    />
  )
}
```

### 2.2 Simplify MDXEditorWrapper

```typescript
// webview-ui/src/components/MDXEditorWrapper.tsx
interface MDXEditorWrapperProps {
  // Remove: markdown: string
  comments?: CommentWithAnchor[]
  defaultFont: FontFamily
  onDirtyStateChange?: (isDirty: boolean) => void
  vscode: any
}

export const MDXEditorWrapper: React.FC<MDXEditorWrapperProps> = ({
  comments,
  defaultFont,
  onDirtyStateChange,
  vscode
}) => {
  // Use plugin state instead of React state
  const { isDirty, canEdit, flushImmediate } = useVSCodeSync()
  
  // Remove all the complex sync logic - it's in the plugin now
  // Remove: handleMarkdownChange, external update effects, etc.
  
  // Simple dirty state effect
  useEffect(() => {
    onDirtyStateChange?.(isDirty)
  }, [isDirty, onDirtyStateChange])
  
  // Save handler
  const handleSave = useCallback(() => {
    flushImmediate()
    if (vscode) {
      vscode.postMessage({ command: 'save' })
    }
  }, [flushImmediate, vscode])
  
  return (
    <div className={`editor-container ${!canEdit ? 'disabled' : ''}`}>
      <MDXEditor
        plugins={[
          // All existing plugins PLUS our sync plugin
          vscSyncPlugin,
          disableUndoRedoPlugin,
          // ... other plugins
        ]}
        // Remove: markdown prop, onChange prop
        // Content is managed entirely by the plugin
      />
    </div>
  )
}
```

## 📋 **Phase 3: Advanced Features (Week 2)**

### 3.1 Enhanced Plugin with Undo/Redo Integration

```typescript
// Add to vscSyncPlugin.ts
export const undoRedoState$ = Cell<{
  canUndo: boolean
  canRedo: boolean
}>({ canUndo: false, canRedo: false })

// In plugin init:
createRootEditorSubscription((rootEditor) => {
  return rootEditor.registerCommand(
    KEY_DOWN_COMMAND,
    (event: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac')
      const isUndo = event.key === 'z' && (isMac ? event.metaKey : event.ctrlKey) && !event.shiftKey
      const isRedo = event.key === 'z' && (isMac ? event.metaKey : event.ctrlKey) && event.shiftKey
      
      if (isUndo || isRedo) {
        // Let VS Code handle undo/redo
        event.preventDefault()
        
        // Send command to VS Code
        if (window.vscodeApi) {
          window.vscodeApi.postMessage({
            command: isUndo ? 'undo' : 'redo'
          })
        }
        
        return true // Prevent Lexical from handling
      }
      
      return false
    },
    COMMAND_PRIORITY_HIGH
  )
})
```

### 3.2 Performance Monitoring

```typescript
// Add to vscSyncPlugin.ts
export const performanceMetrics$ = Cell<{
  avgBatchDelay: number
  totalSyncs: number
  failedSyncs: number
  lastSyncTime: number
}>({
  avgBatchDelay: 0,
  totalSyncs: 0,
  failedSyncs: 0,
  lastSyncTime: 0
})

// Performance tracking in batch flush
realm.sub(flushBatch$, () => {
  const startTime = Date.now()
  
  // ... existing flush logic ...
  
  // Update metrics
  const metrics = realm.getValue(performanceMetrics$)
  realm.pub(performanceMetrics$, {
    ...metrics,
    totalSyncs: metrics.totalSyncs + 1,
    lastSyncTime: Date.now() - startTime
  })
})
```

## 📋 **Phase 4: Migration Strategy (Week 2-3)**

### 4.1 Parallel Implementation Approach

```typescript
// Feature flag for gradual rollout
const USE_PLUGIN_SYNC = process.env.NODE_ENV === 'development' // Start with dev only

// In MDXEditorWrapper:
return USE_PLUGIN_SYNC ? (
  <MDXEditorWithPlugin {...props} />
) : (
  <MDXEditorWithReactState {...props} />
)
```

### 4.2 Testing Strategy

```typescript
// webview-ui/src/plugins/__tests__/vscSyncPlugin.test.ts
describe('vscSyncPlugin', () => {
  let mockRealm: any
  let mockVSCodeApi: any
  
  beforeEach(() => {
    mockRealm = createMockRealm()
    mockVSCodeApi = createMockVSCodeApi()
    window.vscodeApi = mockVSCodeApi
  })
  
  test('should batch rapid typing with correct delays', async () => {
    const plugin = vscSyncPlugin
    plugin.init(mockRealm)
    
    // Simulate rapid typing
    mockRealm.pub(syncToVSCode$, 'hello')
    mockRealm.pub(syncToVSCode$, 'hello world')
    mockRealm.pub(syncToVSCode$, 'hello world!')
    
    // Should only send final content after batch delay
    await jest.advanceTimersByTime(200)
    
    expect(mockVSCodeApi.postMessage).toHaveBeenCalledTimes(1)
    expect(mockVSCodeApi.postMessage).toHaveBeenCalledWith({
      command: 'edit',
      content: 'hello world!'
    })
  })
  
  test('should handle external updates without circular loops', () => {
    // Test external update flow
    mockRealm.pub(receiveFromVSCode$, 'external content')
    
    // Should update editor but not trigger sync back
    expect(mockVSCodeApi.postMessage).not.toHaveBeenCalled()
  })
  
  test('should disable undo/redo and delegate to VS Code', () => {
    // Test undo/redo keyboard shortcuts
    const mockEvent = { key: 'z', ctrlKey: true, preventDefault: jest.fn() }
    
    // Simulate key press
    // Should prevent default and send to VS Code
    expect(mockEvent.preventDefault).toHaveBeenCalled()
    expect(mockVSCodeApi.postMessage).toHaveBeenCalledWith({
      command: 'undo'
    })
  })
})
```

### 4.3 Validation Checklist

```typescript
// Comprehensive test scenarios
const validationTests = [
  'Single character typing → 50ms delay',
  'Rapid typing → 200ms batching',
  'Undo operation → no cursor jump, content correct',
  'External file changes → editor updates',
  'Save operation → immediate flush',
  'Network issues → graceful degradation',
  'Large document → performance maintained',
  'Multiple editors → isolated state',
  'Hot reload → state preservation'
]
```

## 📋 **Phase 5: Rollout and Optimization (Week 3-4)**

### 5.1 Progressive Enhancement

```typescript
// Gradual feature enabling
const PLUGIN_FEATURES = {
  basicSync: true,      // Week 3
  smartBatching: true,  // Week 3  
  undoRedoIntegration: false, // Week 4
  performanceMetrics: false,  // Week 4
  advancedErrorHandling: false // Week 4
}
```

### 5.2 Monitoring and Metrics

```typescript
// Real-time performance dashboard
export const usePluginMetrics = () => {
  const metrics = useCellValue(performanceMetrics$)
  const syncState = useCellValue(syncState$)
  
  return {
    ...metrics,
    isHealthy: metrics.failedSyncs / metrics.totalSyncs < 0.01,
    currentState: syncState,
    recommendations: generateOptimizations(metrics)
  }
}
```

## 🎯 **Expected Outcomes**

### **Benefits:**
- ✅ **Eliminates React state cycles** - no more circular dependencies
- ✅ **Direct Lexical integration** - operates at the editor's native level  
- ✅ **Built-in change detection** - gurx cells automatically track changes
- ✅ **Performance optimization** - adaptive batching with no React overhead
- ✅ **Cleaner architecture** - single reactive pipeline
- ✅ **Better debugging** - gurx dev tools and state inspection

### **Success Metrics:**
- 🎯 Zero cursor jumping during rapid typing
- 🎯 Consistent undo/redo behavior
- 🎯 <50ms perceived latency for single changes  
- 🎯 Efficient batching during rapid typing
- 🎯 No content synchronization issues
- 🎯 Reduced CPU usage during typing

### **Timeline:**
- **Week 1**: Core plugin foundation and basic sync
- **Week 2**: React migration and advanced features  
- **Week 3**: Testing, validation, and gradual rollout
- **Week 4**: Full deployment and optimization

This plugin approach should **finally eliminate** the timing and synchronization issues we've been experiencing by removing the problematic React state layer entirely and operating directly at the Lexical/gurx level.

Ready to proceed with Phase 1?

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Design comprehensive plugin architecture plan", "activeForm": "Designing plugin architecture plan", "status": "completed"}, {"content": "Map current React state to gurx cells and signals", "activeForm": "Mapping React state to gurx", "status": "completed"}, {"content": "Plan migration strategy with minimal disruption", "activeForm": "Planning migration strategy", "status": "completed"}, {"content": "Design testing and validation approach", "activeForm": "Designing testing approach", "status": "completed"}]