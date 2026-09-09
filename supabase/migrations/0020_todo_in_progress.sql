-- To-dos can be marked "in progress" (between open and done).
alter type todo_status add value if not exists 'in_progress' before 'done';
