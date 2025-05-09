# Report Pilot Quick Start Guide

Report Pilot helps you create work reports from Git commits in your workspace. Here's how to get started:

## Installation

1. Install the extension by either:
   - Searching for "Report Pilot" in the VS Code Extensions view
   - Opening the VSIX file with VS Code
   - Running the command: `code --install-extension report-pilot-0.0.1.vsix`

## Basic Usage

1. **Open a Git repository**: Open a folder containing a Git repository in VS Code.

2. **Access Report Pilot**: Click on the Report Pilot icon in the Activity Bar (side bar).

3. **View Commits**: 
   - You'll see recent commits in the "Commits" view.
   - By default, it shows commits from today.
   - Click "Show Recent Commits" to change the time period.

4. **Generate a Report**:
   - Click "Generate Work Report" to create a report from the displayed commits.
   - The report will appear in the "Work Report" view.

5. **Copy the Report**:
   - Right-click on any section of the report and select "Copy Report to Clipboard".
   - You can now paste the report into emails, documents, or chat applications.

## Features

- **Time Period Selection**: Choose from today, yesterday, this week, last week, or a custom date range.
- **Categorized Commits**: Commits are grouped by date for easy reference.
- **Smart Summaries**: The extension attempts to categorize your work by commit message patterns.
- **Markdown Format**: Reports are generated in Markdown format, which can be easily converted to other formats.

## Tips for Better Reports

1. Use consistent commit message formats (like conventional commits: feat:, fix:, docs:)
2. Include ticket/issue numbers in your commit messages for better tracking
3. Use descriptive commit messages that explain what was done

## Configuration Options

You can customize Report Pilot through VS Code settings:

- **Report Pilot: Date Format**: Change how dates are displayed.
- **Report Pilot: Default Timespan**: Set the default time period for viewing commits.

## Troubleshooting

If you don't see any commits:
1. Make sure you're in a Git repository.
2. Check that you have commit history in the repository.
3. Try refreshing the commits using the refresh button.
4. Try selecting a different time period.

If the extension is not working correctly:
1. Check the Output panel in VS Code for any error messages.
2. Make sure your Git installation is working correctly by running git commands in the terminal.