import * as assert from 'assert';
import * as vscode from 'vscode';
import * as dayjs from 'dayjs';
import { getDateRange } from '../utils/gitUtils';

suite('Report Pilot Extension Test Suite', () => {
	vscode.window.showInformationMessage('Starting Report Pilot tests');
"@vscode/test-electron";
	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('your-name.report-pilot'));
	});

	test('Commands should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('report-pilot.showCommits'));
		assert.ok(commands.includes('report-pilot.generateReport'));
		assert.ok(commands.includes('report-pilot.copyReport'));
		assert.ok(commands.includes('report-pilot.refreshCommits'));
	});

	test('Date range utility functions work correctly', () => {
		// Test today's date range
		const todayRange = getDateRange('today');
		assert.ok(todayRange.from);
		assert.ok(todayRange.to);
		assert.ok(todayRange.from.getTime() <= todayRange.to.getTime());

		// Test yesterday's date range
		const yesterdayRange = getDateRange('yesterday');
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		assert.ok(yesterdayRange.from.getTime() < today.getTime());
		assert.ok(yesterdayRange.to.getTime() < today.getTime());
	});
});