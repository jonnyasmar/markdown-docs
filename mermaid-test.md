# Mermaid Diagrams Test

This document tests the new Mermaid diagram rendering functionality with three view modes:
- **📊 Preview**: View rendered diagram only
- **✏️ Edit**: Edit mermaid code only  
- **📱 Split**: Side-by-side code and diagram with real-time updates and resizable panes

## Simple Flowchart

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
```

Try clicking the "📱 Split" button above to see real-time editing!

## Sequence Diagram

```mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>+B: Hello Bob, how are you?
    B-->>-A: Great thanks!
```

## Class Diagram

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +String breed
        +bark()
    }
    Animal <|-- Dog
```

## Gantt Chart

```mermaid
gantt
    title A Gantt Diagram
    dateFormat  YYYY-MM-DD
    section Section
    A task           :a1, 2014-01-01, 30d
    Another task     :after a1, 20d
    section Another
    Task in sec      :2014-01-12, 12d
    another task     :24d
```

Regular code blocks should still work normally:

```javascript
function hello() {
    console.log("Hello, World!");
}
```

```python
def greet(name):
    print(f"Hello, {name}!")
```