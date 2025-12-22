# Weekly Reporter - Copilot Instructions

## Project Overview

Weekly Reporter (智能周报生成工具) is an AI-powered weekly report generation tool that helps users create professional work reports quickly. It's a pure frontend application that integrates with Dify AI API for intelligent content generation and DingTalk API for report submission.

**Target Users:** Enterprise employees, project managers, team leaders, and professionals who need to submit regular work reports.

## Technology Stack

- **Frontend:** Pure HTML5, CSS3, JavaScript (ES6+)
- **No Build System:** Direct browser execution, no compilation needed
- **Storage:** localStorage for configuration and draft persistence
- **External APIs:**
  - Dify AI API for intelligent report generation
  - DingTalk Open Platform API for work report submission
- **Architecture:** Modular JavaScript with ES6 classes

## Project Structure

```
weekly-reporter/
├── index.html              # Main application page
├── script.js               # Core application logic and UI management
├── styles.css              # Application styling
├── AiContentProcessor.js   # AI content processing and formatting
├── ConfigurationManager.js # Configuration import/export management
├── ConfigExportService.js  # Configuration export functionality
├── ConfigImportService.js  # Configuration import functionality
├── DingTalkClient.js       # DingTalk API integration
├── validation-script.js    # Input validation utilities
├── PROMPT.md              # AI prompt definition for report generation
├── design-document.md     # Technical design documentation
└── README.md              # Project documentation
```

## Coding Conventions

### Language and Comments
- **Primary Language:** Chinese (Simplified) for all user-facing text, comments, and documentation
- **Variable Names:** Use descriptive camelCase in English or pinyin for code elements
- **Class Names:** Use PascalCase for class names
- **Comments:** Write in Chinese with clear explanations of functionality

### JavaScript Style
- Use ES6+ features (classes, arrow functions, const/let, template literals)
- Use `const` by default, `let` when reassignment is needed, avoid `var`
- Class-based architecture for major components
- Event-driven programming with proper event binding
- Proper error handling with try-catch blocks and user-friendly error messages

### HTML/CSS Style
- Semantic HTML5 elements
- Clean, indented structure with 4-space indentation
- Use BEM-like naming for CSS classes when appropriate
- Responsive design principles for different screen sizes
- Accessibility considerations (proper labels, ARIA attributes when needed)

### File Organization
- One class per file for major components
- Files named after the class they contain (PascalCase.js)
- Helper scripts use kebab-case (validation-script.js)
- Keep HTML, CSS, and JavaScript separate

## Key Features and Patterns

### 1. Configuration Management
- Use localStorage for persistent configuration and drafts
- Configuration includes Dify API settings and DingTalk credentials
- Support for import/export of configuration as JSON files

### 2. AI Integration
- Integration with Dify AI API for intelligent content generation
- Structured input format: project name | work item | details
- AI processes four inputs: last week's plan, last week's work, next week's plan, additional notes
- Output format: structured JSON with tables and summary

### 3. Content Processing
- Remove AI "think" tags and internal processing markers
- Support multiple think tag formats: `<think>`, `{{think}}`, `[think]`, etc.
- Format markdown tables for display
- Parse JSON from markdown code blocks

### 4. DingTalk Integration
- OAuth 2.0 authentication for DingTalk API
- Support for custom report templates
- Markdown formatting for report content
- Error handling for API failures

### 5. UI/UX Patterns
- Modal dialogs for configuration and history
- Auto-save drafts to localStorage
- Real-time validation of user inputs
- Copy, download, and print functionality for generated reports
- Clear visual feedback for user actions

## API Integration Guidelines

### Dify AI API
- Endpoint configured by user (API URL and API Key)
- Request format: JSON with structured parameters
- Response handling: Parse JSON, remove think content, format for display
- Error handling: Show user-friendly messages for API failures

### DingTalk API
- Use official DingTalk Open Platform endpoints
- Handle access token refresh
- Support custom log templates
- Format content in markdown for rich display

## Error Handling

- Always use try-catch blocks for API calls and JSON parsing
- Provide clear, actionable error messages in Chinese
- Log errors to console for debugging while showing user-friendly messages
- Validate user inputs before processing
- Handle edge cases gracefully (empty inputs, malformed data, network failures)

## LocalStorage Usage

- Save API configurations persistently
- Auto-save input drafts as users type
- Store user preferences and history
- Use descriptive keys with project prefix (e.g., 'weekly-reporter-config')
- Handle localStorage quota exceeded errors

## Testing and Validation

- Manual testing in modern browsers (Chrome, Firefox, Edge, Safari)
- Test API integrations with proper credentials
- Validate JSON parsing and formatting
- Test edge cases: empty inputs, long text, special characters
- Test localStorage functionality across browser sessions
- Verify responsive design on different screen sizes

## Security Considerations

- Never commit API keys or credentials to the repository
- Use HTTPS for all API calls
- Validate and sanitize user inputs
- Store sensitive data only in localStorage (client-side)
- Follow CORS requirements for API integrations
- Implement proper error handling to avoid information leakage

## Documentation Standards

- Keep README.md updated with feature changes
- Document API integration patterns in dify-config.md
- Use clear examples in documentation
- Provide usage instructions in Chinese
- Include common troubleshooting tips

## Development Workflow

- Pure frontend development, no build step required
- Test directly in browser by opening index.html
- Use browser DevTools for debugging
- Validate changes across different browsers
- Keep code modular and maintainable
- Follow existing patterns for consistency

## Future Enhancements

As documented in README.md, potential future features include:
- More report template options
- Online collaboration and sharing
- Support for additional AI service providers
- Data analytics and visualization
- Integration with more platforms (WeChat Work, Feishu, etc.)

## Best Practices

1. **Maintain simplicity:** Keep the pure frontend architecture without unnecessary dependencies
2. **User experience first:** Prioritize intuitive UI and clear feedback
3. **Code quality:** Write clean, maintainable, well-commented code
4. **Error resilience:** Handle all error cases gracefully
5. **Consistency:** Follow established patterns throughout the codebase
6. **Documentation:** Keep documentation in sync with code changes
7. **Accessibility:** Ensure the application is usable by everyone
8. **Performance:** Optimize for fast loading and responsive interactions
