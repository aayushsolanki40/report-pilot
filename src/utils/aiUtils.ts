import * as vscode from 'vscode';
import { OpenAI } from 'openai';
import { CommitInfo } from './gitUtils';
import dayjs from 'dayjs';

// Global OpenAI client
let openaiClient: OpenAI | null = null;

/**
 * Initialize the OpenAI client with the API key from settings
 */
export function initializeOpenAI(): boolean {
    try {
        const apiKey = vscode.workspace.getConfiguration('reportPilot').get('openaiApiKey') as string;
        
        if (!apiKey) {
            vscode.window.showErrorMessage(
                'OpenAI API key not found. Please add it in settings.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand(
                        'workbench.action.openSettings',
                        'reportPilot.openaiApiKey'
                    );
                }
            });
            return false;
        }
        
        openaiClient = new OpenAI({
            apiKey: apiKey
        });
        
        return true;
    } catch (error) {
        console.error('[Report Pilot] Failed to initialize OpenAI client:', error);
        vscode.window.showErrorMessage(`Failed to initialize OpenAI client: ${error}`);
        return false;
    }
}

/**
 * Generate a work report using OpenAI based on commit history
 */
export async function generateOpenAIReport(commits: CommitInfo[]): Promise<string> {
    // Make sure client is initialized
    if (!openaiClient) {
        if (!initializeOpenAI()) {
            return 'Failed to initialize OpenAI client. Please check your API key in settings.';
        }
    }
    
    // Double-check client is available after initialization
    if (!openaiClient) {
        return 'Could not initialize OpenAI client. Please check your API key and try again.';
    }
    
    try {
        if (commits.length === 0) {
            return 'No commits found in the selected time period.';
        }
        
        // Format commit data for the prompt
        const commitData = formatCommitDataForPrompt(commits);
        
        // Create the prompt for OpenAI
        const prompt = createWorkReportPrompt(commitData);
        
        // Call OpenAI API with the now non-null client
        const response = await openaiClient.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system", 
                    content: "You are a technical writing assistant that creates professional work reports from git commit history."
                },
                { 
                    role: "user", 
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });
        
        // Extract and return the generated report
        const reportContent = response.choices[0]?.message?.content;
        
        if (!reportContent) {
            throw new Error('No content received from OpenAI');
        }
        
        return reportContent;
    } catch (error) {
        console.error('[Report Pilot] Error generating report with OpenAI:', error);
        vscode.window.showErrorMessage(`Failed to generate report: ${error}`);
        
        // Return a fallback report
        return `# Work Report (Fallback)

OpenAI report generation failed with error: ${error}

## Commit Summary

${commits.map(commit => `- ${commit.message} (${commit.hash})`).join('\n')}
`;
    }
}

/**
 * Format commit data for the OpenAI prompt
 */
function formatCommitDataForPrompt(commits: CommitInfo[]): string {
    const dateFormat = vscode.workspace.getConfiguration('reportPilot').get('dateFormat', 'YYYY-MM-DD');
    
    // Group commits by day for better organization
    const commitsByDay = new Map<string, CommitInfo[]>();
    
    for (const commit of commits) {
        const dayKey = dayjs(commit.date).format(dateFormat);
        if (!commitsByDay.has(dayKey)) {
            commitsByDay.set(dayKey, []);
        }
        commitsByDay.get(dayKey)?.push(commit);
    }
    
    // Build a formatted string representation of commits
    let formattedData = '';
    
    // Sort days chronologically
    const sortedDays = Array.from(commitsByDay.keys()).sort();
    
    for (const day of sortedDays) {
        const dayCommits = commitsByDay.get(day) || [];
        formattedData += `## ${day}\n\n`;
        
        for (const commit of dayCommits) {
            formattedData += `- "${commit.message}" by ${commit.author} (${commit.hash})\n`;
        }
        
        formattedData += '\n';
    }
    
    return formattedData;
}

/**
 * Create the work report prompt for OpenAI
 */
function createWorkReportPrompt(commitData: string): string {
    return `Please create a professional work report based on the following git commits.
    
The report should include:
1. An executive summary highlighting key accomplishments
2. A breakdown of work by category (features, bug fixes, documentation, etc.)
3. A section identifying themes and patterns in the work
4. Metrics and statistics about the work (number of commits, etc.)

Format the report in Markdown.

Here are the commits:

${commitData}

Please organize the report in a professional manner, with clear headings and sections. Try to identify patterns and themes in the commit messages to create a cohesive narrative about the work completed during this period.`;
}