import * as vscode from 'vscode';
import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import dayjs from 'dayjs'; // Fixed import statement
import * as fs from 'fs';
import * as path from 'path';

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
 * Checks if a directory is a Git repository by looking for a .git folder
 */
export function isGitRepository(directoryPath: string): boolean {
    try {
        const gitDir = path.join(directoryPath, '.git');
        return fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory();
    } catch (error) {
        console.error('Error checking if path is a Git repository:', error);
        return false;
    }
}

/**
 * Gets a Git instance for the current workspace
 */
export function getGit(workspacePath?: string): SimpleGit | null {
    try {
        const path = workspacePath || getWorkspacePath();
        if (!path) {
            vscode.window.showWarningMessage('No workspace folder found.');
            return null;
        }
        
        // Check if the workspace is a Git repository
        if (!isGitRepository(path)) {
            vscode.window.showInformationMessage(`No Git repository found in workspace: ${path}`);
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
            vscode.window.showInformationMessage('Could not initialize Git. Please check if this is a valid Git repository.');
            return [];
        }

        // Format dates for git log
        const fromDate = dayjs(dateRange.from).format('YYYY-MM-DD');
        const toDate = dayjs(dateRange.to).format('YYYY-MM-DD');
        
        // Log the date range for debugging
        console.log(`[Report Pilot] Fetching commits from ${fromDate} to ${toDate}`);
        
        try {
            // First, check if the repository has any commits at all
            const repoStatus = await git.status();
            console.log(`[Report Pilot] Repository status: current branch: ${repoStatus.current}, tracking: ${repoStatus.tracking}`);
        } catch (statusError) {
            console.error('[Report Pilot] Error getting repository status:', statusError);
        }
        
        // Try a simple log first to see if any commits exist
        try {
            const testLog = await git.log(['-n', '1']);
            console.log(`[Report Pilot] Repository has commits: ${testLog.total > 0 ? 'Yes' : 'No'}`);
            if (testLog.total > 0) {
                console.log(`[Report Pilot] Most recent commit: ${testLog.latest?.hash} from ${testLog.latest?.date}`);
            }
        } catch (logError) {
            console.error('[Report Pilot] Error checking for commits:', logError);
        }
        
        // Build git options - use simpler format to avoid parsing errors
        // Use wider date range options for testing
        let options: string[];
        
        if (dateRange.from.getTime() === dateRange.to.getTime()) {
            // If it's the same day, add a bit of padding
            options = ['--all', '-n', '50'];
            console.log('[Report Pilot] Using simplified options to retrieve recent commits');
        } else {
            options = [
                `--after="${fromDate} 00:00:00"`,
                `--before="${toDate} 23:59:59"`,
                '--all'
            ];
        }
        
        // Format setting
        // Use %B for full commit message instead of %s which might be getting truncated
        const formatOption = '--pretty=format:{"hash":"%h","author":"%an <%ae>","date":"%ad","message":"%B"}';
        options.push(formatOption);
        options.push('--date=iso');
        
        if (author) {
            options.push(`--author="${author}"`);
        }

        // Execute git log command
        console.log(`[Report Pilot] Running git log with options: ${options.join(' ')}`);
        
        try {
            const result = await git.log(options);
            const commits = parseGitLog(result);
            console.log(`[Report Pilot] Found ${commits.length} commits with the specified options`);
            
            // If no commits found with the date range, try getting a few recent ones
            if (commits.length === 0) {
                console.log('[Report Pilot] No commits found in date range. Trying to get the most recent commits...');
                const recentResult = await git.log(['-n', '10', '--pretty=format:{"hash":"%h","author":"%an <%ae>","date":"%ad","message":"%s"}', '--date=iso']);
                const recentCommits = parseGitLog(recentResult);
                console.log(`[Report Pilot] Found ${recentCommits.length} recent commits`);
                
                if (recentCommits.length > 0) {
                    // Show a message to the user
                    vscode.window.showInformationMessage('No commits found in the selected time period. Showing the most recent commits instead.');
                    return recentCommits;
                }
            }
            
            return commits;
        } catch (error) {
            console.error('[Report Pilot] Error executing git log:', error);
            throw error;
        }
    } catch (error) {
        console.error('[Report Pilot] Error in getCommitsByDateRange:', error);
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
    
    if (logResult && logResult.all && logResult.all.length > 0) {
        console.log(`[Report Pilot] Parsing ${logResult.all.length} log entries`);
        
        for (const commit of logResult.all) {
            try {
                // Debug the date format
                console.log(`[Report Pilot] Raw date value: ${commit.date}`);
                
                // Ensure date is properly parsed using dayjs
                let commitDate;
                try {
                    commitDate = dayjs(commit.date).toDate();
                    // Validate date
                    if (isNaN(commitDate.getTime())) {
                        console.log(`[Report Pilot] Invalid date parsed: ${commit.date}`);
                        // Fallback to current date if parsing fails
                        commitDate = new Date();
                    }
                } catch (dateError) {
                    console.error(`[Report Pilot] Error parsing date: ${commit.date}`, dateError);
                    commitDate = new Date(); // Default to current date
                }
                
                commits.push({
                    hash: commit.hash,
                    message: commit.message || '[No message]',
                    author: commit.author_name || 'Unknown',
                    date: commitDate,
                    files: []
                });
            } catch (parseError) {
                console.error('[Report Pilot] Error parsing commit:', parseError, commit);
            }
        }
        
        console.log(`[Report Pilot] Successfully parsed ${commits.length} commits`);
    } else {
        console.log('[Report Pilot] No log entries to parse in the result');
        // Debug log result structure
        console.log('[Report Pilot] LogResult structure:', JSON.stringify(logResult, null, 2));
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