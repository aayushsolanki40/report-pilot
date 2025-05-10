import * as vscode from 'vscode';
import dayjs from 'dayjs'; // Fixed import
import { CommitInfo, getCommitsByDateRange, getDateRange, isGitRepository, getWorkspacePath, addBranchInfoToCommits } from '../utils/gitUtils';

/**
 * Tree item representing a commit in the tree view
 */
export class CommitTreeItem extends vscode.TreeItem {
    constructor(
        public readonly commit: CommitInfo,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        // If we have a branch, include it in the label
        const label = commit.branch 
            ? `${commit.message} [${commit.branch}]` 
            : commit.message;
            
        super(label, collapsibleState);

        // Make sure we have a valid date before formatting
        let formattedDate = "Invalid Date";
        
        try {
            // Format the commit date using dayjs
            const dateFormat = vscode.workspace.getConfiguration('reportPilot').get('dateFormat', 'YYYY-MM-DD HH:mm');
            
            // Validate the date before formatting
            if (commit.date && !isNaN(commit.date.getTime())) {
                formattedDate = dayjs(commit.date).format(dateFormat);
            } else {
                console.log(`[Report Pilot] Invalid date detected for commit: ${commit.hash}`);
            }
        } catch (error) {
            console.error(`[Report Pilot] Error formatting date for commit ${commit.hash}:`, error);
        }

        // Set tooltip with detailed information including branch
        let tooltipText = `${commit.message}\n${commit.hash}\n${commit.author}\n${formattedDate}`;
        if (commit.branch) {
            tooltipText += `\nBranch: ${commit.branch}`;
        }
        this.tooltip = tooltipText;
        
        // Set description to show the date in the tree view
        this.description = formattedDate;
        
        // Set the commit hash as the identifier
        this.id = commit.hash;
        
        // Add the git icon
        this.iconPath = new vscode.ThemeIcon('git-commit');
        
        // Make the item contextValue to enable context menu actions
        this.contextValue = 'commit';
    }
}

/**
 * Date separator tree item to group commits by date
 */
export class DateSeparatorTreeItem extends vscode.TreeItem {
    constructor(
        public readonly date: string,
        public readonly commits: CommitInfo[]
    ) {
        super(date, vscode.TreeItemCollapsibleState.Expanded);
        
        // Set tooltip and description
        this.tooltip = `${date} - ${commits.length} commits`;
        this.description = `${commits.length} commits`;
        
        // Set the date as identifier
        this.id = `date-${date}`;
        
        // Add calendar icon
        this.iconPath = new vscode.ThemeIcon('calendar');
        
        // Set context value for context menu
        this.contextValue = 'date';
    }
}

/**
 * Provider for the Git Commit TreeView
 */
export class GitCommitProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeTreeData.event;
    
    private commits: CommitInfo[] = [];
    private timeSpan: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'custom' = 'today';
    private errorMessage: string | null = null;
    private isLoading: boolean = false;
    
    constructor() {
        // Initialize with the default time span from settings
        this.timeSpan = vscode.workspace.getConfiguration('reportPilot').get('defaultTimespan', 'today') as any;
        this.refreshCommits();
    }
    
    /**
     * Refresh commits with the current time span
     */
    public async refreshCommits(newTimeSpan?: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'custom'): Promise<void> {
        if (newTimeSpan) {
            this.timeSpan = newTimeSpan;
        }

        // Reset state
        this.errorMessage = null;
        this.isLoading = true;
        this._onDidChangeTreeData.fire(undefined);
        
        // Check if we're in a Git repository
        const workspacePath = getWorkspacePath();
        if (!workspacePath) {
            this.errorMessage = "No workspace folder found. Please open a folder first.";
            this.isLoading = false;
            this._onDidChangeTreeData.fire(undefined);
            return;
        }
        
        if (!isGitRepository(workspacePath)) {
            this.errorMessage = "No Git repository found in the current workspace.";
            this.isLoading = false;
            this._onDidChangeTreeData.fire(undefined);
            return;
        }

        // Display status message to inform user
        const statusMessage = vscode.window.setStatusBarMessage(`Report Pilot: Loading commits for ${this.getTimeSpanLabel()}...`);
        
        try {
            // Get date range based on the time span
            const dateRange = getDateRange(this.timeSpan);
            console.log(`[Report Pilot] Refreshing commits for timespan: ${this.timeSpan}`);
            
            // Get commits for the date range
            let commits = await getCommitsByDateRange(dateRange);
            
            // Add branch information to the commits
            commits = await addBranchInfoToCommits(commits);
            
            console.log(`[Report Pilot] Provider received ${commits.length} commits`);
            
            this.commits = commits;
            
            if (commits.length === 0) {
                this.errorMessage = `No commits found for ${this.getTimeSpanLabel().toLowerCase()}. Try a different time period.`;
                console.log(`[Report Pilot] No commits found for ${this.timeSpan}`);
            }
        } catch (error) {
            this.errorMessage = `Failed to fetch commits: ${error}`;
            console.error('[Report Pilot] Error in refreshCommits:', error);
            vscode.window.showErrorMessage(this.errorMessage);
        } finally {
            this.isLoading = false;
            statusMessage.dispose();
            this._onDidChangeTreeData.fire(undefined);
        }
    }
    
    /**
     * Get TreeItem representation of the element
     */
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }
    
    /**
     * Get the children of the element
     */
    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        // If we're loading, show a "Loading..." item
        if (this.isLoading) {
            const loadingItem = new vscode.TreeItem("Loading commits...");
            loadingItem.iconPath = new vscode.ThemeIcon('sync');
            return [loadingItem];
        }
        
        // If we have an error message, show it
        if (this.errorMessage) {
            const errorItem = new vscode.TreeItem(this.errorMessage);
            errorItem.iconPath = new vscode.ThemeIcon('error');
            
            // Add a hint about changing the time period
            const changePeriodItem = new vscode.TreeItem("Click to select a different time period");
            changePeriodItem.iconPath = new vscode.ThemeIcon('calendar');
            changePeriodItem.command = {
                command: 'report-pilot.showCommits',
                title: 'Select Time Period',
                tooltip: 'Change the time period for commits'
            };
            
            return [errorItem, changePeriodItem];
        }
        
        // If no commits are available, return a message
        if (!this.commits.length) {
            const noCommitsItem = new vscode.TreeItem("No commits found");
            noCommitsItem.iconPath = new vscode.ThemeIcon('info');
            
            return [noCommitsItem];
        }
        
        // If no element is provided, group commits by date
        if (!element) {
            const commitsByDate = new Map<string, CommitInfo[]>();
            const dateFormat = vscode.workspace.getConfiguration('reportPilot').get('dateFormat', 'YYYY-MM-DD');
            
            // Add the current time period as the first item
            const items: vscode.TreeItem[] = [];
            const timePeriodItem = new vscode.TreeItem(`Time Period: ${this.getTimeSpanLabel()}`);
            timePeriodItem.iconPath = new vscode.ThemeIcon('clock');
            timePeriodItem.description = `${this.commits.length} commits found`;
            timePeriodItem.tooltip = 'Click to change time period';
            timePeriodItem.command = {
                command: 'report-pilot.showCommits',
                title: 'Change Time Period',
                tooltip: 'Select a different time period for commits'
            };
            items.push(timePeriodItem);
            
            // Group commits by date
            for (const commit of this.commits) {
                const dateKey = dayjs(commit.date).format(dateFormat);
                if (!commitsByDate.has(dateKey)) {
                    commitsByDate.set(dateKey, []);
                }
                commitsByDate.get(dateKey)?.push(commit);
            }
            
            // Create date separator items, sorted by date in descending order (newest first)
            const sortedDates = Array.from(commitsByDate.keys()).sort((a, b) => {
                // Convert string dates to Date objects for comparison
                const dateA = dayjs(a).toDate();
                const dateB = dayjs(b).toDate();
                return dateB.getTime() - dateA.getTime(); // Descending order
            });
            
            for (const date of sortedDates) {
                const commits = commitsByDate.get(date) || [];
                items.push(new DateSeparatorTreeItem(date, commits));
            }
            
            return items;
        }
        
        // If a date separator is provided, return commits for that date
        if (element instanceof DateSeparatorTreeItem) {
            // Sort commits by date in descending order (newest first)
            const sortedCommits = [...element.commits].sort((a, b) => 
                b.date.getTime() - a.date.getTime()
            );
            
            return sortedCommits.map(commit => 
                new CommitTreeItem(commit, vscode.TreeItemCollapsibleState.None)
            );
        }
        
        return [];
    }
    
    /**
     * Get a human-readable label for the current time span
     */
    private getTimeSpanLabel(): string {
        switch(this.timeSpan) {
            case 'today': return 'Today';
            case 'yesterday': return 'Yesterday';
            case 'thisWeek': return 'This Week';
            case 'lastWeek': return 'Last Week';
            case 'custom': return 'Custom Range';
            default: return this.timeSpan;
        }
    }
    
    /**
     * Change the time span and refresh commits
     */
    public async changeTimeSpan(): Promise<void> {
        const options = [
            { label: 'Today', description: 'Show commits from today', value: 'today' },
            { label: 'Yesterday', description: 'Show commits from yesterday', value: 'yesterday' },
            { label: 'This Week', description: 'Show commits from this week', value: 'thisWeek' },
            { label: 'Last Week', description: 'Show commits from last week', value: 'lastWeek' },
            { label: 'All Recent Commits', description: 'Show the most recent commits regardless of date', value: 'all' },
            { label: 'Custom Date Range', description: 'Specify a custom date range', value: 'custom' }
        ];
        
        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select time span for commits'
        });
        
        if (selection) {
            if (selection.value === 'all') {
                // Special case: show all recent commits
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Report Pilot: Loading recent commits",
                    cancellable: false
                }, async (progress) => {
                    this.isLoading = true;
                    this._onDidChangeTreeData.fire(undefined);
                    
                    try {
                        const git = await import('simple-git');
                        const workspacePath = getWorkspacePath();
                        if (workspacePath) {
                            const simpleGitInstance = git.default(workspacePath);
                            
                            // Use standard git log options - this works reliably
                            const result = await simpleGitInstance.log([
                                '-n', '50',
                                '--date=iso'
                            ]);
                            
                            console.log(`[Report Pilot] All Recent Commits found ${result?.all?.length || 0} commits`);
                            
                            if (result && result.all && result.all.length > 0) {
                                // Map the result directly to our CommitInfo format
                                this.commits = result.all.map(commit => ({
                                    hash: commit.hash,
                                    message: commit.message || '[No message]',
                                    author: commit.author_name || 'Unknown',
                                    date: new Date(commit.date),
                                    files: []
                                }));
                                
                                this.timeSpan = 'custom';
                                this.errorMessage = null;
                                console.log(`[Report Pilot] Processed ${this.commits.length} commits for All Recent`);
                                
                                // Debug the first few commits to check message content
                                this.commits.slice(0, 3).forEach((commit, i) => {
                                    console.log(`[Report Pilot] Commit ${i}: hash=${commit.hash}, message="${commit.message}"`);
                                });
                            } else {
                                this.errorMessage = "No commits found in the repository";
                            }
                        }
                    } catch (error) {
                        this.errorMessage = `Failed to fetch commits: ${error}`;
                        vscode.window.showErrorMessage(this.errorMessage);
                    } finally {
                        this.isLoading = false;
                        this._onDidChangeTreeData.fire(undefined);
                    }
                });
                
                return;
            } else if (selection.value === 'custom') {
                // Handle custom date range
                const fromDate = await vscode.window.showInputBox({
                    prompt: 'Enter start date (YYYY-MM-DD)',
                    placeHolder: 'e.g. 2023-01-01',
                    validateInput: (input) => {
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
                            return 'Please enter a date in YYYY-MM-DD format';
                        }
                        return null;
                    }
                });
                
                if (!fromDate) {
                    return;
                }
                
                const toDate = await vscode.window.showInputBox({
                    prompt: 'Enter end date (YYYY-MM-DD)',
                    placeHolder: 'e.g. 2023-01-31',
                    validateInput: (input) => {
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
                            return 'Please enter a date in YYYY-MM-DD format';
                        }
                        return null;
                    }
                });
                
                if (!toDate) {
                    return;
                }
                
                // Parse dates
                const from = new Date(fromDate);
                from.setHours(0, 0, 0, 0);
                
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999);
                
                // Show loading indicator
                this.isLoading = true;
                this._onDidChangeTreeData.fire(undefined);
                
                try {
                    this.commits = await getCommitsByDateRange({ from, to });
                    this.timeSpan = 'custom';
                    if (this.commits.length === 0) {
                        this.errorMessage = `No commits found between ${fromDate} and ${toDate}`;
                    } else {
                        this.errorMessage = null;
                    }
                } catch (error) {
                    this.errorMessage = `Failed to fetch commits: ${error}`;
                    vscode.window.showErrorMessage(this.errorMessage);
                } finally {
                    this.isLoading = false;
                    this._onDidChangeTreeData.fire(undefined);
                }
            } else {
                await this.refreshCommits(selection.value as any);
            }
        }
    }
    
    /**
     * Get the current list of commits
     */
    public getCommits(): CommitInfo[] {
        return this.commits;
    }
}