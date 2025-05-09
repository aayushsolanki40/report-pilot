import * as vscode from 'vscode';
import dayjs from 'dayjs'; // Fixed import
import { CommitInfo, getCommitsByDateRange, getDateRange } from '../utils/gitUtils';

/**
 * Tree item representing a commit in the tree view
 */
export class CommitTreeItem extends vscode.TreeItem {
    constructor(
        public readonly commit: CommitInfo,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(commit.message, collapsibleState);

        // Format the commit date
        const dateFormat = vscode.workspace.getConfiguration('reportPilot').get('dateFormat', 'YYYY-MM-DD HH:mm');
        const formattedDate = dayjs(commit.date).format(dateFormat);

        // Set tooltip with detailed information
        this.tooltip = `${commit.message}\n${commit.hash}\n${commit.author}\n${formattedDate}`;
        
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

        // Get date range based on the time span
        const dateRange = getDateRange(this.timeSpan);
        
        try {
            this.commits = await getCommitsByDateRange(dateRange);
            this._onDidChangeTreeData.fire(undefined);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch commits: ${error}`);
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
        if (!this.commits.length) {
            return [];
        }
        
        // If no element is provided, group commits by date
        if (!element) {
            const commitsByDate = new Map<string, CommitInfo[]>();
            const dateFormat = vscode.workspace.getConfiguration('reportPilot').get('dateFormat', 'YYYY-MM-DD');
            
            // Group commits by date
            for (const commit of this.commits) {
                const dateKey = dayjs(commit.date).format(dateFormat);
                if (!commitsByDate.has(dateKey)) {
                    commitsByDate.set(dateKey, []);
                }
                commitsByDate.get(dateKey)?.push(commit);
            }
            
            // Create date separator items
            const items: vscode.TreeItem[] = [];
            
            for (const [date, commits] of commitsByDate) {
                items.push(new DateSeparatorTreeItem(date, commits));
            }
            
            return items;
        }
        
        // If a date separator is provided, return commits for that date
        if (element instanceof DateSeparatorTreeItem) {
            return element.commits.map(commit => 
                new CommitTreeItem(commit, vscode.TreeItemCollapsibleState.None)
            );
        }
        
        return [];
    }
    
    /**
     * Change the time span and refresh commits
     */
    public async changeTimeSpan(): Promise<void> {
        const options = [
            { label: 'Today', value: 'today' },
            { label: 'Yesterday', value: 'yesterday' },
            { label: 'This Week', value: 'thisWeek' },
            { label: 'Last Week', value: 'lastWeek' },
            { label: 'Custom Date Range', value: 'custom' }
        ];
        
        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select time span for commits'
        });
        
        if (selection) {
            if (selection.value === 'custom') {
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
                
                this.commits = await getCommitsByDateRange({ from, to });
                this._onDidChangeTreeData.fire(undefined);
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