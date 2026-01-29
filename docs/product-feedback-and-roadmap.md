General:
1. Fonts are too small.
2. UI is boring, and colors are dull.
3. Remove the button that leads to the about page from all pages. Keep the about menu item in the app native menu.

Analysis screen:
1. Filters should be above the table (Also, do this on the rule manager screen)
2. Use tabs for months so that I can quickly switch between last three months. But also keep the filter by month.
3. Add "Group by" label before "All, Category, Owner, Account". Add "Order/Sort by" label before "Total" (remove order by Name)
4. When the current transactions only have one category, we hide group by category. This is incorrect. We should always keep it visible. And the same thing applies to the group by owner and group by account.

Import screen:
1. Support importing xls files.
2. Instead of having a multi-step import process where one step assigns one column, Simply render the table and above each column we have a select list so that the user can select which file column maps to which app column. Of course, all existing rules should be preserved, like the description can be mapped multiple times because we can have multiple description columns. And the amount column is tricky. Like we can have an inverted amount where we need to flip the sign. Or we might have two columns, one for debit, one for credit. Or we can have an amount column and amount type column. And amount type decides the sign of the amount. And other rules, if any.
3. Right now, if I import the same file twice, the transactions will be duplicated. This is bad. If the user imports the same file twice, we should ask the user whether they want to proceed and overwrite the transactions or cancel the input. But we need to be careful because in a single file, the user can have transactions from multiple months the first time. If the first time they import the first months and the second time they import the second month, we shouldn't warn because there is no duplication. So only in the case where they import the same months on the same file second time, we should ask whether to overwrite or cancel.
4. I should be able to select the mapping for the file. I like that we automatically try to match the file to existing mapping. But if it's wrong, I want to be able to select it manually and at the same time I want to be able to edit the name of the mapping on the same screen. It's annoying that I cannot do so.
5. Also, the owner column is never going to be present in the file. Almost none of the bunks return the owner. So we should just have an input field like we have right now, but we shouldn't call it default owner, we should just call it owner.
