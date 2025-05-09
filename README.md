# Report Pilot

Report Pilot is a VS Code extension that helps developers generate work reports based on Git commits. It makes it easy to create summaries of your work over a specific time period, which can be useful for daily standups, weekly reports, or project status updates.

## Features

- **View Git Commits**: Display a structured view of Git commits from your current workspace
- **Filter Commits**: Filter commits by author and time range
- **Generate Reports**: Automatically generate work reports from your commits
- **Group Commits**: Group commits by common patterns (features, bug fixes, etc.)
- **Copy Reports**: Easily copy generated reports to the clipboard

## Getting Started

1. Install the extension from the VS Code Marketplace
2. Open a project with Git history
3. Click on the Report Pilot icon in the Activity Bar
4. Use "Show Commits" to fetch your recent Git commits
5. Use "Generate Report" to create a work report based on these commits

## Commands

This extension provides the following commands:

- `Report Pilot: Show Commits`: Fetches and displays Git commits for your workspace
- `Report Pilot: Generate Work Report`: Creates a formatted work report from the fetched commits

## Settings

This extension contributes the following settings:

- `reportPilot.enable`: Enable/disable the Report Pilot extension
- `reportPilot.defaultDays`: Default number of days to include in the report (default: 1)
- `reportPilot.groupCommits`: Group commits by feature/task in the report (default: true)

## Requirements

- Git must be installed and accessible in your PATH
- Your workspace must be a Git repository

## Tips for Best Results

- Use consistent commit message formats to improve the automatic grouping
- Consider using conventional commit format (e.g., feat:, fix:, docs:) for better report organization

## Release Notes

### 0.0.1

- Initial release of Report Pilot
- Basic commit viewing and report generation

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)