import * as vscode from 'vscode';
import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import dayjs from 'dayjs'; // Fixed import statement

export interface CommitInfo {
    hash: string;
    date: Date;
    message: string;
    author: string;
    files?: string[];
}

export interface DateRange {
    from: Date;
    to: Date;
}

/**
 * Gets a Git instance for the current workspace
 */
export function getGit(workspacePath?: string): SimpleGit | null {
    try {
        const path = workspacePath || getWorkspacePath();
        if (!path) {
            return null;
        }
        return simpleGit(path);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize Git: ${error}`);
        return null;
    }
}

/**
 * Gets the current workspace path
 */
export function getWorkspacePath(): string | undefined {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return undefined;
}

/**
 * Get commits within a date range
 */
export async function getCommitsByDateRange(
    dateRange: DateRange,
    author?: string
): Promise<CommitInfo[]> {
    try {
        const git = getGit();
        if (!git) {
            return [];
        }

        // Format dates for git log
        const fromDate = dayjs(dateRange.from).format('YYYY-MM-DD');
        const toDate = dayjs(dateRange.to).format('YYYY-MM-DD');
        
        // Build git options
        const options: string[] = [
            `--after="${fromDate}"`,
            `--before="${toDate} 23:59:59"`,
            '--pretty=format:{"hash":"%h","author":"%an <%ae>","date":"%ad","message":"%s"}',
            '--date=iso'
        ];
        
        if (author) {
            options.push(`--author="${author}"`);
        }

        // Execute git log command
        const result = await git.log(options);
        return parseGitLog(result);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to get commits: ${error}`);
        return [];
    }
}

/**
 * Get commits from today
 */
export async function getTodaysCommits(author?: string): Promise<CommitInfo[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return getCommitsByDateRange({
        from: today,
        to: new Date()
    }, author);
}

/**
 * Parse git log output into structured commit information
 */
function parseGitLog(logResult: LogResult): CommitInfo[] {
    const commits: CommitInfo[] = [];
    
    if (logResult && logResult.all) {
        for (const commit of logResult.all) {
            commits.push({
                hash: commit.hash,
                message: commit.message,
                author: commit.author_name,
                date: new Date(commit.date),
                files: [] // Simple-git doesn't include files in the default log format, so we'll use an empty array
            });
        }
    }
    
    return commits;
}

/**
 * Get predefined date ranges for common time periods
 */
export function getDateRange(period: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'custom' = 'today'): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
        case 'today':
            return {
                from: today,
                to: now
            };
        case 'yesterday': {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return {
                from: yesterday,
                to: new Date(today.getTime() - 1) // End of yesterday
            };
        }
        case 'thisWeek': {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            return {
                from: startOfWeek,
                to: now
            };
        }
        case 'lastWeek': {
            const startOfLastWeek = new Date(today);
            startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
            const endOfLastWeek = new Date(today);
            endOfLastWeek.setDate(today.getDate() - today.getDay() - 1);
            endOfLastWeek.setHours(23, 59, 59, 999);
            return {
                from: startOfLastWeek,
                to: endOfLastWeek
            };
        }
        default:
            return {
                from: today,
                to: now
            };
    }
}

/**
 * Summarize commits into a report format
 */
export function summarizeCommits(commits: CommitInfo[]): string {
    if (commits.length === 0) {
        return 'No commits found in the selected time period.';
    }

    const dateFormat = vscode.workspace.getConfiguration('reportPilot').get('dateFormat', 'YYYY-MM-DD');
    
    // Group commits by day
    const commitsByDay = new Map<string, CommitInfo[]>();
    
    for (const commit of commits) {
        const dayKey = dayjs(commit.date).format(dateFormat);
        if (!commitsByDay.has(dayKey)) {
            commitsByDay.set(dayKey, []);
        }
        commitsByDay.get(dayKey)?.push(commit);
    }
    
    // Format the report
    let report = '# Work Report\n\n';
    
    for (const [day, dayCommits] of commitsByDay) {
        report += `## ${day}\n\n`;
        
        for (const commit of dayCommits) {
            report += `- ${commit.message} (${commit.hash})\n`;
        }
        
        report += '\n';
    }
    
    // Add a summary section
    report += '## Summary\n\n';
    report += `Total commits: ${commits.length}\n`;
    
    if (commits.length > 0) {
        report += `Time period: ${dayjs(commits[commits.length - 1].date).format(dateFormat)} to ${dayjs(commits[0].date).format(dateFormat)}\n\n`;
    }
    
    // Group by commit message patterns to identify major work areas
    const taskPatterns: Record<string, number> = {};
    
    for (const commit of commits) {
        // Extract general task area from commit message
        // This is a simple implementation - you might want to improve this with more sophisticated analysis
        const taskMatch = commit.message.match(/^([\w\-]+):/);
        if (taskMatch && taskMatch[1]) {
            const task = taskMatch[1];
            taskPatterns[task] = (taskPatterns[task] || 0) + 1;
        }
    }
    
    // Add work areas to the summary
    if (Object.keys(taskPatterns).length > 0) {
        report += 'Work areas:\n';
        for (const [task, count] of Object.entries(taskPatterns)) {
            report += `- ${task}: ${count} commits\n`;
        }
    }
    
    return report;
}