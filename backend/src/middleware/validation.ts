import { Request, Response, NextFunction } from 'express';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateLoginInput(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !email.trim()) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Please provide a valid email address.',
      field: 'email',
    });
    return;
  }

  const normalizedEmail = email.trim();
  if (normalizedEmail.length > 254 || !EMAIL_REGEX.test(normalizedEmail)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'The email address format is invalid.',
      field: 'email',
    });
    return;
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Please provide your password.',
      field: 'password',
    });
    return;
  }

  if (password.length > 256) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Password exceeds maximum allowable length.',
      field: 'password',
    });
    return;
  }

  req.body.email = normalizedEmail;
  next();
}
