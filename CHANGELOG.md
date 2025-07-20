# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.2] - 2025-07-20

### Added
- Version updates and documentation improvements for v1.4.2 release

### Changed
- Updated package version and CLI version references
- Refreshed documentation with current timestamps

## [1.4.1] - 2025-07-19

### Added
- Session memory function for tool calls to maintain conversation context
- User confirmation prompts for tool execution to improve safety
- Enhanced shell tool with secondary prompt capabilities
- Comprehensive test coverage expansion

### Changed
- Improved logging system with better cleanup and organization
- Documentation cleanup and codebase refactoring preparation
- Enhanced development workflow and code quality measures

### Fixed
- Various stability improvements and bug fixes

## [1.4.0] - 2025-07-19

### Added
- **Shell MCP Tool**: New shell command execution capability
  - Execute bash commands directly from AI conversations
  - Secure command execution with timeout protection
  - Proper stdout/stderr capture and error handling
  - Integrated with existing MCP tool architecture
- Enhanced AI assistant capabilities with shell command support

### Technical Details
- Added `ShellMCPClient` extending the MCP framework
- Integrated shell tool with `MCPToolService`
- Command execution via Node.js `child_process.exec`
- Tool available as `shell_RunCommand` to AI providers

## [1.3.0] - 2025-07-14

### Added
- Enhanced MCP tools system with improved file operations
- Better error handling and streamlined tool architecture
- Improved tool integration and reliability

### Changed
- Streamlined MCP tool architecture for better performance
- Enhanced file operation capabilities

### Fixed
- Various improvements to tool stability and error handling

## [1.2.0] - 2024-12-XX

### Added
- Multi-provider support for Ollama, OpenAI, and Google Gemini
- Runtime provider switching with `/model-switch` command
- Unified CommandRegistry system for better command management
- Development quality setup with ESLint and Prettier
- Comprehensive test suite with Vitest
- Improved setup wizard with interactive configuration

### Changed
- Enhanced terminal interface with better user experience
- Improved configuration management with multi-provider support

## [1.1.1] - 2024-XX-XX

### Added
- Enhanced terminal UI with modern terminal behaviors
- Improved user experience and interface responsiveness

## [1.0.0] - 2024-XX-XX

### Added
- Initial release with basic terminal tool functionality
- Ollama support for local model integration
- Filesystem MCP tooling for file operations
- Basic chat interface and file search capabilities