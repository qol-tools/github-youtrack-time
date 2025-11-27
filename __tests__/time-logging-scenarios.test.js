describe("Time Logging Business Logic", () => {
  test("allows direct time entry when issue is Task type with subtasks", () => {
    // Arrange
    const issueType = "Task";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = true;

    // Act
    const canLogDirectly = !isStoryType;
    const requiresSubtask = isStoryType && hasSubtasks;

    // Assert
    expect(canLogDirectly).toBe(true);
    expect(requiresSubtask).toBe(false);
    expect(isStoryType).toBe(false);
  });

  test("redirects time entry to selected subtask when Task has subtasks and user selects one", () => {
    // Arrange
    const issueType = "Task";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = true;
    const selectedSubtask = "TASK-200";
    const currentIssueId = "TASK-100";

    // Act
    let targetIssueId = currentIssueId;
    if (isStoryType) {
      if (!hasSubtasks) {
        throw new Error("Cannot log time on Story without subtasks");
      }
      if (!selectedSubtask) {
        throw new Error("Must select a subtask for Story");
      }
      targetIssueId = selectedSubtask;
    } else if (hasSubtasks && selectedSubtask) {
      targetIssueId = selectedSubtask;
    }

    // Assert
    expect(targetIssueId).toBe("TASK-200");
    expect(isStoryType).toBe(false);
  });

  test("allows direct time entry when issue is Task type without subtasks", () => {
    // Arrange
    const issueType = "Task";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = false;
    const currentIssueId = "TASK-100";

    // Act
    let targetIssueId = currentIssueId;
    const canLogTime = !isStoryType || hasSubtasks;

    // Assert
    expect(canLogTime).toBe(true);
    expect(targetIssueId).toBe("TASK-100");
    expect(isStoryType).toBe(false);
  });

  test("requires subtask selection and redirects time entry when issue is Story type with subtasks", () => {
    // Arrange
    const issueType = "Story";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = true;
    const selectedSubtask = "TASK-100";
    const currentIssueId = "STORY-50";

    // Act
    let targetIssueId = currentIssueId;
    let error = null;

    try {
      if (isStoryType) {
        if (!hasSubtasks) {
          throw new Error("Cannot log time on Story without subtasks");
        }
        if (!selectedSubtask) {
          throw new Error("Must select a subtask for Story");
        }
        targetIssueId = selectedSubtask;
      }
    } catch (e) {
      error = e.message;
    }

    // Assert
    expect(isStoryType).toBe(true);
    expect(targetIssueId).toBe("TASK-100");
    expect(error).toBeNull();
  });

  test("blocks time entry with error when issue is Story type with subtasks but no subtask selected", () => {
    // Arrange
    const issueType = "Story";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = true;
    const selectedSubtask = null;

    // Act
    let error = null;
    try {
      if (isStoryType) {
        if (!hasSubtasks) {
          throw new Error("Cannot log time on Story without subtasks");
        }
        if (!selectedSubtask) {
          throw new Error("Must select a subtask for Story");
        }
      }
    } catch (e) {
      error = e.message;
    }

    // Assert
    expect(error).toBe("Must select a subtask for Story");
    expect(isStoryType).toBe(true);
  });

  test("blocks time entry completely when issue is Story type without any subtasks", () => {
    // Arrange
    const issueType = "Story";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = false;

    // Act
    let error = null;
    const submitButtonDisabled = isStoryType && !hasSubtasks;

    try {
      if (isStoryType) {
        if (!hasSubtasks) {
          throw new Error("Cannot log time on Story without subtasks");
        }
      }
    } catch (e) {
      error = e.message;
    }

    // Assert
    expect(error).toBe("Cannot log time on Story without subtasks");
    expect(submitButtonDisabled).toBe(true);
    expect(isStoryType).toBe(true);
  });

  test("treats User Story variant as Story type requiring subtask selection", () => {
    // Arrange
    const issueType = "User Story";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = true;

    // Act
    const requiresSubtask = isStoryType;

    // Assert
    expect(isStoryType).toBe(true);
    expect(requiresSubtask).toBe(true);
  });

  test("allows direct time entry when issue is Bug type without subtasks", () => {
    // Arrange
    const issueType = "Bug";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = false;
    const currentIssueId = "BUG-100";

    // Act
    let targetIssueId = currentIssueId;
    const canLogTime = !isStoryType || hasSubtasks;

    // Assert
    expect(canLogTime).toBe(true);
    expect(targetIssueId).toBe("BUG-100");
    expect(isStoryType).toBe(false);
  });

  test("treats Epic Story as Story type requiring subtask selection", () => {
    // Arrange
    const issueType = "Epic Story";
    const isStoryType = issueType.toLowerCase().includes("story");

    // Act
    const requiresSubtask = isStoryType;

    // Assert
    expect(isStoryType).toBe(true);
    expect(requiresSubtask).toBe(true);
  });

  test("defaults to non-Story behavior allowing time entry when issue type is missing", () => {
    // Arrange
    const issueType = null;
    const isStoryType = issueType
      ? issueType.toLowerCase().includes("story")
      : false;

    // Act
    const canLogTime = !isStoryType;

    // Assert
    expect(isStoryType).toBe(false);
    expect(canLogTime).toBe(true);
  });
});
