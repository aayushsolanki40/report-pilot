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
        
        console.log(`[Report Pilot] Fetching commits from ${fromDate} to ${toDate}`);
        
        // Build git options - simplified approach
        let options: string[] = [];
        
        // Add date range - using simpler syntax that works more reliably
        options.push(`--since="${fromDate}"`);
        options.push(`--until="${toDate} 23:59:59"`);
        
        // Limit results but ensure we get enough data
        options.push('-n', '100');
        
        // Add author filter if specified
        if (author) {
            options.push(`--author="${author}"`);
        }
        
        // Format setting - using %B for full message
        options.push('--date=iso');
        options.push('--pretty=format:{"hash":"%h","author":"%an <%ae>","date":"%ad","message":"%s"}');
        
        console.log(`[Report Pilot] Running git log with options: ${options.join(' ')}`);
        
        try {
            const result = await git.log(options);
            const commits = parseGitLog(result);
            console.log(`[Report Pilot] Found ${commits.length} commits with the specified options`);
            
            // If no commits found with the date range
            if (commits.length === 0) {
                console.log('[Report Pilot] No commits found in date range.');
                
                // Only for "today" or "yesterday" show fallback message
                if (dayjs(dateRange.to).diff(dayjs(dateRange.from), 'day') <= 1) {
                    vscode.window.showInformationMessage(`No commits found for ${dayjs(dateRange.from).format('YYYY-MM-DD')}.`);
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
                to: yesterday // Use the same day for "yesterday" for clearer filtering
            };
        }
        case 'thisWeek': {
            // Get first day of current week (Sunday = 0)
            const startOfWeek = new Date(today);
            const currentDay = today.getDay(); // 0 for Sunday, 1 for Monday, etc.
            startOfWeek.setDate(today.getDate() - currentDay); // Go back to Sunday
            return {
                from: startOfWeek,
                to: now
            };
        }
        case 'lastWeek': {
            // Last week = 7-13 days ago
            const startOfLastWeek = new Date(today);
            const currentDay = today.getDay();
            // Go back to Sunday of last week
            startOfLastWeek.setDate(today.getDate() - currentDay - 7);
            
            const endOfLastWeek = new Date(startOfLastWeek);
            endOfLastWeek.setDate(startOfLastWeek.getDate() + 6); // Saturday of last week
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

/**
 * Generate an AI-enhanced work report based on commit data
 * This function uses more advanced techniques to categorize and summarize work
 */
export function generateAIWorkReport(commits: CommitInfo[]): string {
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
    
    // Start the report with a title
    let report = '# Work Report\n\n';
    
    // 1. Add an executive summary section that highlights key accomplishments
    report += '## Executive Summary\n\n';
    
    // Analyze commit messages to identify key themes
    const keywords = analyzeCommitKeywords(commits);
    const features = identifyFeatures(commits);
    const bugFixes = identifyBugFixes(commits);
    
    if (features.length > 0) {
        report += '### Key Features Implemented:\n';
        features.forEach(feature => {
            report += `- ${feature}\n`;
        });
        report += '\n';
    }
    
    if (bugFixes.length > 0) {
        report += '### Bug Fixes:\n';
        bugFixes.forEach(bugFix => {
            report += `- ${bugFix}\n`;
        });
        report += '\n';
    }

    // 2. Add a work breakdown by day section
    report += '## Daily Work Breakdown\n\n';
    
    // Sort days chronologically
    const sortedDays = Array.from(commitsByDay.keys()).sort();
    for (const day of sortedDays) {
        const dayCommits = commitsByDay.get(day) || [];
        report += `### ${day}\n\n`;
        
        // Group commits by type (feature, fix, docs, etc.)
        const commitsByType = categorizeCommitsByType(dayCommits);
        
        for (const [type, typeCommits] of Object.entries(commitsByType)) {
            if (typeCommits.length > 0) {
                report += `**${capitalizeFirstLetter(type)}:**\n`;
                typeCommits.forEach(commit => {
                    // Clean up the commit message
                    const cleanMessage = cleanCommitMessage(commit.message);
                    report += `- ${cleanMessage} (${commit.hash})\n`;
                });
                report += '\n';
            }
        }
    }
    
    // 3. Add metrics and statistics
    report += '## Work Metrics\n\n';
    report += `- **Total commits:** ${commits.length}\n`;
    
    // Calculate commits per day
    const daysWorked = commitsByDay.size;
    const commitsPerDay = daysWorked > 0 ? (commits.length / daysWorked).toFixed(1) : '0';
    report += `- **Days worked:** ${daysWorked}\n`;
    report += `- **Commits per day:** ${commitsPerDay}\n`;
    
    // Add time period
    if (commits.length > 0) {
        // Sort commits chronologically
        const sortedCommits = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
        const startDate = dayjs(sortedCommits[0].date).format(dateFormat);
        const endDate = dayjs(sortedCommits[sortedCommits.length - 1].date).format(dateFormat);
        report += `- **Time period:** ${startDate} to ${endDate}\n\n`;
    }
    
    // 4. Add work focus areas from keyword analysis
    if (Object.keys(keywords).length > 0) {
        report += '## Focus Areas\n\n';
        
        // Sort keywords by frequency
        const sortedKeywords = Object.entries(keywords)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Take top 5
            
        sortedKeywords.forEach(([keyword, count]) => {
            report += `- **${keyword}:** ${count} occurrences\n`;
        });
        report += '\n';
    }
    
    return report;
}

/**
 * Analyzes commit messages to extract meaningful keywords
 */
function analyzeCommitKeywords(commits: CommitInfo[]): Record<string, number> {
    const keywords: Record<string, number> = {};
    const stopwords = ['the', 'a', 'an', 'and', 'in', 'on', 'at', 'to', 'for', 'with', 'by'];
    
    for (const commit of commits) {
        // Extract words from commit message
        const words = commit.message
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
            .split(/\s+/) // Split on whitespace
            .filter(word => word.length > 3 && !stopwords.includes(word)); // Filter out short words and stopwords
            
        // Count occurrences
        words.forEach(word => {
            if (!keywords[word]) {
                keywords[word] = 0;
            }
            keywords[word]++;
        });
    }
    
    return keywords;
}

/**
 * Identify feature implementations from commits
 */
function identifyFeatures(commits: CommitInfo[]): string[] {
    const features: string[] = [];
    
    // Look for feature-related commits
    for (const commit of commits) {
        const message = commit.message.toLowerCase();
        
        // Check for feature patterns
        if (
            message.startsWith('feat') || 
            message.includes('implement') || 
            message.includes('add') ||
            message.includes('new') ||
            message.includes('feature')
        ) {
            // Clean up and extract the feature description
            let feature = commit.message
                .replace(/^feat(\(.*?\))?:?\s*/i, '') // Remove conventional commit prefix
                .replace(/^add\s*/i, '')  // Remove "add" prefix
                .replace(/^implement\s*/i, '') // Remove "implement" prefix
                .trim();
                
            // Capitalize first letter
            feature = capitalizeFirstLetter(feature);
            
            if (feature.length > 0) {
                features.push(feature);
            }
        }
    }
    
    return features;
}

/**
 * Identify bug fixes from commits
 */
function identifyBugFixes(commits: CommitInfo[]): string[] {
    const fixes: string[] = [];
    
    // Look for fix-related commits
    for (const commit of commits) {
        const message = commit.message.toLowerCase();
        
        // Check for fix patterns
        if (
            message.startsWith('fix') || 
            message.includes('bug') || 
            message.includes('issue') ||
            message.includes('error') ||
            message.includes('problem') ||
            message.includes('resolve')
        ) {
            // Clean up and extract the fix description
            let fix = commit.message
                .replace(/^fix(\(.*?\))?:?\s*/i, '') // Remove conventional commit prefix
                .replace(/^fixed\s*/i, '') // Remove "fixed" prefix
                .trim();
                
            // Capitalize first letter
            fix = capitalizeFirstLetter(fix);
            
            if (fix.length > 0) {
                fixes.push(fix);
            }
        }
    }
    
    return fixes;
}

/**
 * Categorize commits by their conventional commit type
 */
function categorizeCommitsByType(commits: CommitInfo[]): Record<string, CommitInfo[]> {
    const categories: Record<string, CommitInfo[]> = {
        'feature': [],
        'fix': [],
        'docs': [],
        'refactor': [],
        'test': [],
        'chore': [],
        'other': []
    };
    
    for (const commit of commits) {
        const message = commit.message.toLowerCase();
        
        // Check for conventional commit prefixes
        if (message.startsWith('feat')) {
            categories['feature'].push(commit);
        } else if (message.startsWith('fix')) {
            categories['fix'].push(commit);
        } else if (message.startsWith('docs')) {
            categories['docs'].push(commit);
        } else if (message.startsWith('refactor')) {
            categories['refactor'].push(commit);
        } else if (message.startsWith('test')) {
            categories['test'].push(commit);
        } else if (message.startsWith('chore')) {
            categories['chore'].push(commit);
        } else {
            // Content-based categorization for non-conventional commits
            if (
                message.includes('implement') || 
                message.includes('add') || 
                message.includes('new') || 
                message.includes('feature')
            ) {
                categories['feature'].push(commit);
            } else if (
                message.includes('fix') || 
                message.includes('bug') || 
                message.includes('issue') ||
                message.includes('error')
            ) {
                categories['fix'].push(commit);
            } else if (
                message.includes('document') || 
                message.includes('readme') || 
                message.includes('comment')
            ) {
                categories['docs'].push(commit);
            } else if (
                message.includes('refactor') || 
                message.includes('restructure') || 
                message.includes('improve') ||
                message.includes('clean')
            ) {
                categories['refactor'].push(commit);
            } else if (
                message.includes('test') || 
                message.includes('spec') || 
                message.includes('assert')
            ) {
                categories['test'].push(commit);
            } else if (
                message.includes('config') || 
                message.includes('version') || 
                message.includes('upgrade') ||
                message.includes('bump') ||
                message.includes('merge')
            ) {
                categories['chore'].push(commit);
            } else {
                categories['other'].push(commit);
            }
        }
    }
    
    // Filter out empty categories (without using Object.fromEntries which requires ES2019+)
    const result: Record<string, CommitInfo[]> = {};
    for (const [type, typeCommits] of Object.entries(categories)) {
        if (typeCommits.length > 0) {
            result[type] = typeCommits;
        }
    }
    
    return result;
}

/**
 * Clean up commit messages for better readability
 */
function cleanCommitMessage(message: string): string {
    return message
        .replace(/^(feat|fix|docs|refactor|test|chore)(\(.*?\))?:?\s*/i, '')
        .trim();
}

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirstLetter(str: string): string {
    if (!str || str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}