# Report Pilot

Report Pilot is a VS Code extension that helps developers generate work reports based on Git commits. It makes it easy to create summaries of your work over a specific time period, which can be useful for daily standups, weekly reports, or project status updates.

![Report Pilot Banner](resources/banner.png)

## Key Features

- **Git Commit Tracking**: Access and view Git commits for your current workspace
- **Flexible Time Filtering**: Filter commits by specific time periods (today, yesterday, this week, etc.)
- **Smart Report Generation**: Automatically generate formatted work reports from commits
- **Work Summarization**: Get intelligent summaries that categorize your work by patterns
- **One-Click Sharing**: Copy reports to clipboard for easy sharing via email or chat

## How to Use

1. **Open a Git Repository**: Launch VS Code with a folder that contains a Git repository.

2. **Access Report Pilot**: Click on the Report Pilot icon in the Activity Bar (side bar).

3. **View and Filter Commits**:
   - The "Commits" view displays your recent Git commits.
   - Use the dropdown or command palette to filter by time period.
   - Commits are automatically grouped by date.

4. **Generate a Work Report**:
   - Click "Generate Work Report" in the view or command palette.
   - The report will appear in the "Work Report" view.

5. **Customize and Share**:
   - View the report summary and details.
   - Copy the report to clipboard with a single click.
   - Paste into emails, documents, or chat applications.

## Commands

- `Report Pilot: Show Recent Commits` - Display commits for a selected time period
- `Report Pilot: Generate Work Report` - Create a report from visible commits
- `Report Pilot: Copy Report to Clipboard` - Copy the current report
- `Report Pilot: Refresh Commits` - Refresh the commit list

## Settings

This extension contributes the following settings:

- `reportPilot.dateFormat`: Format for displaying dates in reports (default: "YYYY-MM-DD")
- `reportPilot.defaultTimespan`: Default time period for viewing commits (default: "today")

## Tips for Better Results

For best results with Report Pilot:

1. **Use consistent commit message formats**: Ideally following conventional commits (feat:, fix:, docs:)
2. **Include ticket/issue numbers**: This helps with traceability in your reports
3. **Write descriptive commit messages**: This makes your reports more meaningful


**Enjoy more productive standups with Report Pilot!**