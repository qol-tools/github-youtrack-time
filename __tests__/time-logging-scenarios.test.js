describe("Time Logging Business Logic", () => {
  test("allows direct time entry when issue is Task type with subtasks", () => {
    // Arrange
    const issueType = "Task";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = true;
    const selectedSubtask = null;
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
    expect(isStoryType).toBe(false);
    expect(targetIssueId).toBe("TASK-100");
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
    expect(isStoryType).toBe(false);
    expect(targetIssueId).toBe("TASK-200");
  });

  test("allows direct time entry when issue is Task type without subtasks", () => {
    // Arrange
    const issueType = "Task";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = false;
    const currentIssueId = "TASK-100";

    // Act
    let targetIssueId = currentIssueId;
    if (isStoryType && !hasSubtasks) {
      throw new Error("Cannot log time on Story without subtasks");
    }

    // Assert
    expect(isStoryType).toBe(false);
    expect(targetIssueId).toBe("TASK-100");
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
    if (isStoryType) {
      if (!hasSubtasks) {
        throw new Error("Cannot log time on Story without subtasks");
      }
      if (!selectedSubtask) {
        throw new Error("Must select a subtask for Story");
      }
      targetIssueId = selectedSubtask;
    }

    // Assert
    expect(isStoryType).toBe(true);
    expect(targetIssueId).toBe("TASK-100");
  });

  test("blocks time entry with error when issue is Story type with subtasks but no subtask selected", () => {
    // Arrange
    const issueType = "Story";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = true;
    const selectedSubtask = null;

    // Act
    const attemptTimeEntry = () => {
      if (isStoryType) {
        if (!hasSubtasks) {
          throw new Error("Cannot log time on Story without subtasks");
        }
        if (!selectedSubtask) {
          throw new Error("Must select a subtask for Story");
        }
      }
    };

    // Assert
    expect(attemptTimeEntry).toThrow("Must select a subtask for Story");
  });

  test("blocks time entry completely when issue is Story type without any subtasks", () => {
    // Arrange
    const issueType = "Story";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = false;

    // Act
    const attemptTimeEntry = () => {
      if (isStoryType && !hasSubtasks) {
        throw new Error("Cannot log time on Story without subtasks");
      }
    };

    // Assert
    expect(attemptTimeEntry).toThrow("Cannot log time on Story without subtasks");
  });

  test("treats User Story variant as Story type and redirects to selected subtask", () => {
    // Arrange
    const issueType = "User Story";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = true;
    const selectedSubtask = "TASK-100";
    const currentIssueId = "STORY-50";

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
    }

    // Assert
    expect(isStoryType).toBe(true);
    expect(targetIssueId).toBe("TASK-100");
  });

  test("allows direct time entry when issue is Bug type without subtasks", () => {
    // Arrange
    const issueType = "Bug";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = false;
    const currentIssueId = "BUG-100";

    // Act
    let targetIssueId = currentIssueId;
    if (isStoryType && !hasSubtasks) {
      throw new Error("Cannot log time on Story without subtasks");
    }

    // Assert
    expect(isStoryType).toBe(false);
    expect(targetIssueId).toBe("BUG-100");
  });

  test("treats Epic Story as Story type and blocks when no subtask selected", () => {
    // Arrange
    const issueType = "Epic Story";
    const isStoryType = issueType.toLowerCase().includes("story");
    const hasSubtasks = true;
    const selectedSubtask = null;

    // Act
    const attemptTimeEntry = () => {
      if (isStoryType) {
        if (!hasSubtasks) {
          throw new Error("Cannot log time on Story without subtasks");
        }
        if (!selectedSubtask) {
          throw new Error("Must select a subtask for Story");
        }
      }
    };

    // Assert
    expect(attemptTimeEntry).toThrow("Must select a subtask for Story");
  });

  test("defaults to non-Story behavior allowing time entry when issue type is missing", () => {
    // Arrange
    const issueType = null;
    const isStoryType = issueType
      ? issueType.toLowerCase().includes("story")
      : false;
    const currentIssueId = "TASK-100";

    // Act
    let targetIssueId = currentIssueId;
    if (isStoryType) {
      throw new Error("Should not reach here");
    }

    // Assert
    expect(isStoryType).toBe(false);
    expect(targetIssueId).toBe("TASK-100");
  });
});
